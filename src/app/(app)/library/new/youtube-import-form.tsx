"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTextFromYoutube,
  saveBrowserYoutubeTranscript,
  type BrowserYoutubeTranscript,
  type YoutubeImportState,
} from "../youtube-actions";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

type BridgeStatus = "checking" | "ready" | "missing";

const BRIDGE_SOURCE = "lexreader-youtube-bridge";
const REQUEST_TIMEOUT_MS = 45_000;

interface BridgeResponse {
  source: typeof BRIDGE_SOURCE;
  type: "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE";
  requestId: string;
  ok: boolean;
  transcript?: BrowserYoutubeTranscript;
  error?: string;
}

function requestTranscriptFromBridge(
  url: string,
  targetLanguage: string,
): Promise<BrowserYoutubeTranscript> {
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
        reject(new Error(data.error || "Не удалось получить субтитры через расширение."));
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
    async (previousState: YoutubeImportState, formData: FormData): Promise<YoutubeImportState> => {
      if (bridgeStatus !== "ready") {
        return createTextFromYoutube(previousState, formData);
      }

      const url = String(formData.get("url") ?? "").trim();
      try {
        const transcript = await requestTranscriptFromBridge(url, targetLanguage);
        const result = await saveBrowserYoutubeTranscript(transcript, formData);
        if (result.redirectTo) {
          router.push(result.redirectTo);
        }
        return result;
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Не удалось получить субтитры.",
        };
      }
    },
    [bridgeStatus, router, targetLanguage],
  );

  const [state, formAction, pending] = useActionState<YoutubeImportState, FormData>(
    importAction,
    {},
  );

  if (state.paywall) {
    return <PaywallNotice />;
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <input
        type="url"
        name="url"
        required
        placeholder="https://www.youtube.com/watch?v=…"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <p className="text-sm text-black/50 dark:text-white/50">
        После импорта можно смотреть видео, читать синхронные субтитры, тапать слова и
        сохранять перевод.
      </p>
      <p
        className={`text-sm ${
          bridgeStatus === "ready"
            ? "text-green-700 dark:text-green-400"
            : "text-black/50 dark:text-white/50"
        }`}
        aria-live="polite"
      >
        {bridgeStatus === "checking" && "Проверяем браузерный мост…"}
        {bridgeStatus === "ready" &&
          "LexReader Bridge подключён — YouTube не сможет заблокировать запрос по IP Vercel."}
        {bridgeStatus === "missing" && (
          <>
            Браузерный мост не найден. Попробуем серверный импорт. Для стабильной работы{" "}
            <a
              href="/lexreader-youtube-bridge.zip"
              download
              className="font-medium text-caramel underline underline-offset-2"
            >
              скачай LexReader Bridge
            </a>
            , распакуй архив и добавь папку через chrome://extensions.
          </>
        )}
      </p>
      <CollectionPicker collections={collections} />
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400" aria-live="polite">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? "Получаем субтитры…" : "Импортировать субтитры"}
      </button>
    </form>
  );
}
