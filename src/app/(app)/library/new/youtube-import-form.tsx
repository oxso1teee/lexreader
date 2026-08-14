"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/posthog-client";
import { startYoutubeImportFromBrowserAction, type StartYoutubeImportState } from "../youtube-import-actions";
import type { TranscriptResult } from "@/lib/youtube-ingestion/types";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

type BridgeStatus = "checking" | "ready" | "missing";

const BRIDGE_SOURCE = "lexreader-youtube-bridge";
// Lifecycle bug (M3 Slice 12 RC #4): must stay above background.mjs's own
// OVERALL_TIMEOUT_MS (50s) plus messaging overhead -- a real captured ASR
// transcript body can exceed 1MB and take multiple seconds to fetch+read on
// a real connection, so the whole extension-side budget was extended; the
// client's own ceiling has to extend with it or it gives up first.
const REQUEST_TIMEOUT_MS = 58_000;

interface BridgeResponse {
  source: typeof BRIDGE_SOURCE;
  type: "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE";
  requestId: string;
  ok: boolean;
  transcript?: TranscriptResult;
  error?: string;
  message?: string;
}

// Typed failure codes from background.mjs/youtube-content-relay.js (M3
// Slice 12 Gate #2C §11) mapped to honest, specific Russian copy -- never
// shown as a raw internal error string.
const BRIDGE_ERROR_MESSAGES: Record<string, string> = {
  extension_not_connected: "LexReader Bridge отключён. Перезапусти расширение и обнови страницу.",
  transcript_unavailable: "У этого видео нет доступных субтитров.",
  youtube_page_not_open: "Не удалось открыть страницу видео на YouTube. Попробуй ещё раз.",
  extraction_failed: "Не удалось получить субтитры с YouTube. Попробуй ещё раз.",
  unsupported_video: "Не распознана ссылка на YouTube-видео.",
};

function requestTranscriptFromBridge(
  url: string,
  targetLanguage: string,
): Promise<TranscriptResult> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      reject(new Error("Расширение не ответило. Перезапусти Chrome и попробуй ещё раз."));
    }, REQUEST_TIMEOUT_MS);

    function handleResponse(event: MessageEvent<unknown>) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as Partial<BridgeResponse> | null;
      if (
        !data ||
        data.source !== BRIDGE_SOURCE ||
        data.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE" ||
        data.requestId !== requestId
      ) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", handleResponse);
      if (!data.ok || !data.transcript) {
        const code = data.error ?? "extraction_failed";
        reject(new Error(BRIDGE_ERROR_MESSAGES[code] ?? data.message ?? "Не удалось получить субтитры через расширение."));
        return;
      }
      resolve(data.transcript);
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
        const transcript = await requestTranscriptFromBridge(url, targetLanguage);
        const result = await startYoutubeImportFromBrowserAction(transcript, formData);
        if (result.redirectTo) {
          track("material_add_succeeded", { source: "youtube" });
          router.push(result.redirectTo);
        } else if (result.paywall) {
          track("material_add_failed", { source: "youtube", reason: "limit" });
        } else if (result.error) {
          track("material_add_failed", { source: "youtube", reason: "validation_or_server" });
        }
        return result;
      } catch (error) {
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
      <button
        type="submit"
        disabled={pending || bridgeStatus !== "ready"}
        className="focus-ring min-h-11 rounded-full bg-[var(--color-forest)] px-5 py-3 font-bold text-white transition-colors hover:bg-[var(--color-forest-deep)] disabled:opacity-50"
      >
        {pending ? "Получаем субтитры…" : "Импортировать субтитры"}
      </button>
    </form>
  );
}
