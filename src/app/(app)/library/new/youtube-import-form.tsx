"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/posthog-client";
import { startYoutubeImportFromBrowserAction, type StartYoutubeImportState } from "../youtube-import-actions";
import type { TranscriptResult } from "@/lib/youtube-ingestion/types";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

type BridgeStatus = "checking" | "ready" | "missing";
type ExtractionStage =
  | "opening_video"
  | "opening_transcript"
  | "reading_transcript"
  | "collecting_segments"
  | "network_fallback"
  | "importing"
  | "ready";

const BRIDGE_SOURCE = "lexreader-youtube-bridge";
const WATCH_DIAGNOSTIC_STORAGE_KEY = "lexreader:youtube-import-watch-diagnostic";
// The extension owns one 90-second emergency ceiling. This page-side guard is
// deliberately larger, so it cannot beat an actively progressing virtualized
// DOM collection and recreate the former 10-20 second false failure.
const REQUEST_TIMEOUT_MS = 105_000;

interface BridgeMessage {
  source?: string;
  type?: string;
  requestId?: string;
  ok?: boolean;
  transcript?: TranscriptResult;
  error?: string;
  message?: string;
  stage?: string;
}

const EXTRACTION_STAGE_MESSAGES: Record<ExtractionStage, string> = {
  opening_video: "Открываем видео…",
  opening_transcript: "Открываем расшифровку YouTube…",
  reading_transcript: "Читаем расшифровку…",
  collecting_segments: "Собираем субтитры по всему видео…",
  network_fallback: "Проверяем резервный источник субтитров…",
  importing: "Сохраняем текст и субтитры…",
  ready: "Субтитры готовы.",
};

function isExtractionStage(stage: string): stage is ExtractionStage {
  return stage in EXTRACTION_STAGE_MESSAGES;
}

// Typed failure codes from background.mjs/youtube-content-relay.js (M3
// Slice 12 Gate #2C §11) mapped to honest, specific Russian copy -- never
// shown as a raw internal error string.
const BRIDGE_ERROR_MESSAGES: Record<string, string> = {
  extension_not_connected: "LexReader Bridge отключён. Перезапусти расширение и обнови страницу.",
  transcript_unavailable: "У этого видео нет доступных субтитров.",
  youtube_page_not_open: "Не удалось открыть страницу видео на YouTube. Попробуй ещё раз.",
  extraction_failed: "Не удалось получить субтитры с YouTube. Попробуй ещё раз.",
  origin_delivery_failed: "Готовые субтитры не удалось вернуть во вкладку LexReader. Вкладка YouTube оставлена открытой для диагностики.",
  unsupported_video: "Не распознана ссылка на YouTube-видео.",
};

function requestTranscriptFromBridge(
  url: string,
  targetLanguage: string,
  onProgress: (stage: ExtractionStage) => void,
): Promise<{ transcript: TranscriptResult; requestId: string }> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      reject(new Error("Расширение не ответило. Перезапусти Chrome и попробуй ещё раз."));
    }, REQUEST_TIMEOUT_MS);

    function handleResponse(event: MessageEvent<unknown>) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as BridgeMessage | null;
      if (
        !data ||
        data.source !== BRIDGE_SOURCE ||
        data.requestId !== requestId
      ) {
        return;
      }

      if (
        data.type === "LEXREADER_YOUTUBE_EXTRACTION_PROGRESS" &&
        typeof data.stage === "string" &&
        isExtractionStage(data.stage)
      ) {
        onProgress(data.stage);
        return;
      }

      if (data.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE") return;

      window.clearTimeout(timeout);
      window.removeEventListener("message", handleResponse);
      if (!data.ok || !data.transcript) {
        const code = data.error ?? "extraction_failed";
        reject(new Error(BRIDGE_ERROR_MESSAGES[code] ?? data.message ?? "Не удалось получить субтитры через расширение."));
        return;
      }
      console.debug("[LexReader:diag] lexreader_page_received_success", {
        requestId,
        videoId: data.transcript.videoId,
        uniqueSegments: data.transcript.segments.length,
      });
      resolve({ transcript: data.transcript, requestId });
    }

    window.addEventListener("message", handleResponse);
    window.postMessage(
      {
        source: "lexreader-web",
        type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST",
        requestId,
        url,
        targetLanguage,
      },
      window.location.origin,
    );
  });
}

export default function YoutubeImportForm({
  targetLanguage,
  collections,
}: {
  targetLanguage: string;
  collections: CollectionOption[];
}) {
  const router = useRouter();
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("checking");
  const [extractionStage, setExtractionStage] = useState<ExtractionStage | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setBridgeStatus("missing"), 1_200);

    function handleMessage(event: MessageEvent<unknown>) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (
        data?.source === BRIDGE_SOURCE &&
        data.type === "LEXREADER_YOUTUBE_BRIDGE_READY"
      ) {
        window.clearTimeout(timeout);
        setBridgeStatus("ready");
      }
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      { source: "lexreader-web", type: "LEXREADER_YOUTUBE_BRIDGE_PING" },
      window.location.origin,
    );

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const importAction = useCallback(
    async (_previousState: StartYoutubeImportState, formData: FormData): Promise<StartYoutubeImportState> => {
      track("material_add_started", { source: "youtube" });

      // Browser extension is the primary (and, for the zero-cost build,
      // only) YouTube ingestion path -- see docs/ui/m3-slice12-gate2c
      // report. We deliberately do NOT fall back to the parked
      // server-worker path here: it isn't deployed anywhere reachable, and
      // silently trying it would only ever surface a confusing
      // "worker unavailable" error instead of the honest "install the
      // extension" prompt already shown below.
      if (bridgeStatus !== "ready") {
        track("material_add_failed", { source: "youtube", reason: "extension_not_installed" });
        return {
          error: "Для импорта YouTube-видео нужно расширение LexReader Bridge — см. подсказку ниже.",
        };
      }

      const url = String(formData.get("url") ?? "").trim();
      try {
        setExtractionStage("opening_video");
        const { transcript, requestId } = await requestTranscriptFromBridge(url, targetLanguage, setExtractionStage);
        setExtractionStage("importing");
        console.debug("[LexReader:diag] lexreader_import_request_started", {
          requestId,
          videoId: transcript.videoId,
          uniqueSegments: transcript.segments.length,
        });
        const result = await startYoutubeImportFromBrowserAction(transcript, formData, requestId);
        if (result.redirectTo) {
          setExtractionStage("ready");
          track("material_add_succeeded", { source: "youtube" });
          console.debug("[LexReader:diag] lexreader_persistence_success", {
            requestId,
            videoId: transcript.videoId,
            redirectTo: result.redirectTo,
          });
          window.sessionStorage.setItem(WATCH_DIAGNOSTIC_STORAGE_KEY, JSON.stringify({
            requestId,
            videoId: transcript.videoId,
            redirectTo: result.redirectTo,
          }));
          console.debug("[LexReader:diag] redirect_started", {
            requestId,
            redirectTo: result.redirectTo,
          });
          router.push(result.redirectTo);
        } else if (result.paywall) {
          console.debug("[LexReader:diag] lexreader_persistence_failure", {
            requestId,
            videoId: transcript.videoId,
            reason: "paywall",
          });
          track("material_add_failed", { source: "youtube", reason: "limit" });
        } else if (result.error) {
          console.debug("[LexReader:diag] lexreader_persistence_failure", {
            requestId,
            videoId: transcript.videoId,
            reason: "server_action_error",
          });
          track("material_add_failed", { source: "youtube", reason: "validation_or_server" });
        }
        return result;
      } catch (error) {
        setExtractionStage(null);
        track("material_add_failed", { source: "youtube", reason: "bridge_error" });
        return {
          error: error instanceof Error ? error.message : "Не удалось получить субтитры.",
        };
      }
    },
    [bridgeStatus, router, targetLanguage],
  );

  const [state, formAction, pending] = useActionState<StartYoutubeImportState, FormData>(
    importAction,
    {},
  );

  if (state.paywall) {
    return <PaywallNotice />;
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="youtube-import-url" className="text-sm font-semibold">
          Ссылка на видео
        </label>
        <input
          id="youtube-import-url"
          type="url"
          name="url"
          required
          placeholder="https://www.youtube.com/watch?v=…"
          className="focus-ring w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-base outline-none"
        />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        После импорта можно смотреть видео, читать синхронные субтитры, тапать слова и
        сохранять перевод. Работает для видео с открытыми субтитрами.
      </p>
      <p
        className={`text-sm ${bridgeStatus === "ready" ? "text-[var(--color-success-text)]" : "text-[var(--text-secondary)]"}`}
        aria-live="polite"
      >
        {bridgeStatus === "checking" && "Проверяем браузерный мост…"}
        {bridgeStatus === "ready" && "LexReader Bridge подключён."}
        {bridgeStatus === "missing" && (
          <>
            Для импорта нужно расширение LexReader Bridge.{" "}
            <a
              href="/lexreader-youtube-bridge.zip"
              download
              className="focus-ring font-semibold text-[var(--color-caramel-text)] underline underline-offset-2"
            >
              Скачай его
            </a>
            , распакуй архив и добавь папку через chrome://extensions, затем обнови страницу.
          </>
        )}
      </p>
      <CollectionPicker collections={collections} />
      {state.error && (
        <p className="text-sm text-[var(--color-danger)]" role="alert" aria-live="polite">
          {state.error}
        </p>
      )}
      {pending && extractionStage && (
        <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
          {EXTRACTION_STAGE_MESSAGES[extractionStage]}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || bridgeStatus !== "ready"}
        className="focus-ring min-h-11 rounded-full bg-[var(--color-forest)] px-5 py-3 font-bold text-white transition-colors hover:bg-[var(--color-forest-deep)] disabled:opacity-50"
      >
        {pending && extractionStage
          ? EXTRACTION_STAGE_MESSAGES[extractionStage]
          : "Импортировать субтитры"}
      </button>
    </form>
  );
}
