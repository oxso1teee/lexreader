import { fetchYoutubeTranscript } from "./youtube-transcript.mjs";

const ALLOWED_APP_ORIGINS = new Set([
  "https://lexreader.vercel.app",
  "https://lexreader.app",
  "https://www.lexreader.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function isAllowedSender(sender) {
  if (!sender?.url) return false;
  try {
    return ALLOWED_APP_ORIGINS.has(new URL(sender.url).origin);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LEXREADER_YOUTUBE_BRIDGE_PING") {
    sendResponse({ ok: isAllowedSender(sender) });
    return false;
  }

  if (
    message?.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST" ||
    !isAllowedSender(sender)
  ) {
    return false;
  }

  fetchYoutubeTranscript(message.url, message.targetLanguage)
    .then((transcript) => sendResponse({ ok: true, transcript }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Не удалось получить субтитры.",
      }),
    );

  return true;
});
