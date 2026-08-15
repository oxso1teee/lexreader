// Literal real-browser proof for Slice 12's DOM-primary extractor.
//
// This deliberately sends `domOnly: true`: background.mjs cannot invoke the
// network fallback and youtube-page-capture.js returns before patching either
// fetch or XMLHttpRequest. All videos run sequentially in one persistent
// extension instance and one LexReader page.
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, `out/dom-primary-profile-${Date.now()}`);
const appOrigin = process.argv[2] ?? "http://localhost:3000";
const allowNetworkFallback = process.argv.includes("--allow-network");
const domOnly = !allowNetworkFallback;
const defaultVideos = [
  { videoId: "PolmvqSxnbc", label: "mandatory-long" },
  { videoId: "jNQXAC9IVRw", label: "short-regression" },
  { videoId: "aircAruvnKk", label: "long-regression" },
];
const requestedVideoIds = process.argv.slice(3).filter((value) => value !== "--allow-network");
const videos = requestedVideoIds.length > 0
  ? requestedVideoIds.map((videoId) => ({ videoId, label: `requested-${videoId}` }))
  : defaultVideos;

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--disable-blink-features=AutomationControlled",
    "--autoplay-policy=user-gesture-required",
  ],
});

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => null);
if (!worker) throw new Error("LexReader Bridge service worker did not start");
worker.on("console", (message) => {
  const value = message.text();
  if (value.includes("[LexReader:diag]")) console.log("[service-worker]", value);
});

const temporaryTabs = [];
context.on("page", (temporaryPage) => {
  const openedAt = Date.now();
  const record = { page: temporaryPage, openedAt, closedAt: null, lastUrl: temporaryPage.url() };
  temporaryTabs.push(record);
  temporaryPage.on("framenavigated", (frame) => {
    if (frame === temporaryPage.mainFrame()) record.lastUrl = frame.url();
  });
  temporaryPage.on("console", (message) => {
    const value = message.text();
    if (value.includes("[LexReader:diag]")) console.log("[youtube-tab]", value);
  });
  temporaryPage.on("close", () => { record.closedAt = Date.now(); });
});

// Warm a fresh profile once. This is navigation only; it does not issue a
// LexReader transcript request. A watch URL reliably renders YouTube's
// regional consent UI whereas its home shell may keep DOMContentLoaded open.
const warmup = await context.newPage();
await warmup
  .goto(`https://www.youtube.com/watch?v=${videos[0].videoId}&autoplay=0`, { waitUntil: "commit", timeout: 30_000 })
  .catch((error) => console.log(`[proof] optional YouTube warm-up skipped: ${error.message}`));
const rejectCookies = await warmup.waitForFunction(() => [...document.querySelectorAll("button")].find((button) => {
  const label = `${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`;
  return /Reject all|Reject the use of cookies|Отклонить все/i.test(label);
}) ?? null, null, { timeout: 25_000 }).catch(() => null);
if (rejectCookies) {
  await rejectCookies.evaluate((button) => button.click());
  await warmup.waitForTimeout(1_000);
  console.log("[proof] fresh-profile YouTube consent dismissed with Reject all");
}
await warmup.close();

const page = await context.newPage();
await page.goto(`${appOrigin}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });

const bridgeReady = await page.evaluate(() => new Promise((resolve) => {
  const timer = setTimeout(() => finish(false), 5_000);
  function finish(value) {
    clearTimeout(timer);
    window.removeEventListener("message", onMessage);
    resolve(value);
  }
  function onMessage(event) {
    if (
      event.source === window &&
      event.origin === window.location.origin &&
      event.data?.source === "lexreader-youtube-bridge" &&
      event.data?.type === "LEXREADER_YOUTUBE_BRIDGE_READY"
    ) finish(true);
  }
  window.addEventListener("message", onMessage);
  window.postMessage(
    { source: "lexreader-web", type: "LEXREADER_YOUTUBE_BRIDGE_PING" },
    window.location.origin,
  );
}));
if (!bridgeReady) throw new Error("LexReader Bridge handshake failed");

async function requestDomOnly(videoId) {
  const requestStartedAt = Date.now();
  const result = await page.evaluate(({ videoId, domOnly }) => new Promise((resolve) => {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const progress = [];
    let terminalCount = 0;
    let terminalTimer = null;
    let firstTerminal = null;
    const timeout = setTimeout(() => finish({
      ok: false,
      error: "proof_timeout",
      requestId,
      progress,
      terminalCount,
    }), 105_000);

    function finish(value) {
      clearTimeout(timeout);
      clearTimeout(terminalTimer);
      window.removeEventListener("message", onMessage);
      resolve(value);
    }

    function onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== "lexreader-youtube-bridge" || data.requestId !== requestId) return;
      if (data.type === "LEXREADER_YOUTUBE_EXTRACTION_PROGRESS") {
        progress.push({ stage: data.stage, details: data.details, atMs: Date.now() - startedAt });
        return;
      }
      if (data.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE") return;
      terminalCount += 1;
      firstTerminal ??= data;
      // Keep the listener alive briefly after the first terminal event. This
      // catches the historical success-then-failure overwrite while keeping
      // the three-video proof reasonably light on YouTube.
      clearTimeout(terminalTimer);
      terminalTimer = setTimeout(() => finish({ ...firstTerminal, progress, terminalCount }), 1_500);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({
      source: "lexreader-web",
      type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST",
      requestId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      targetLanguage: "en",
      domOnly,
    }, window.location.origin);
  }), { videoId, domOnly });

  const elapsedMs = Date.now() - requestStartedAt;
  const segments = result.transcript?.segments ?? [];
  const diagnostics = result.diagnostics ?? {};
  const progress = result.progress ?? [];
  const maxProgressSegments = progress.reduce(
    (maximum, entry) => Math.max(maximum, Number(entry.details?.uniqueSegments) || 0),
    0,
  );
  const tabRecord = [...temporaryTabs]
    .reverse()
    .find((entry) => entry.lastUrl.includes(`v=${videoId}`));
  return {
    videoId,
    ok: result.ok === true,
    error: result.error ?? null,
    acquisitionSource: diagnostics.acquisitionSource ?? null,
    durationMs: diagnostics.durationMs ?? null,
    uniqueSegments: diagnostics.uniqueSegments ?? segments.length,
    firstMs: diagnostics.firstMs ?? segments[0]?.startMs ?? null,
    lastMs: diagnostics.lastMs ?? segments.at(-1)?.startMs ?? null,
    scrollIterations: diagnostics.scrollIterations ?? null,
    duplicatesDiscarded: diagnostics.duplicatesDiscarded ?? null,
    completeness: diagnostics.completeness ?? null,
    passes: diagnostics.collectionPasses ?? null,
    elapsedMs,
    extractorElapsedMs: diagnostics.elapsedMs ?? null,
    terminalCount: result.terminalCount,
    progressStages: progress.map((entry) => entry.stage),
    maxProgressSegments,
    lastProgress: progress.at(-1) ?? null,
    temporaryTabClosed: Boolean(tabRecord?.closedAt),
    firstSegment: segments[0] ?? null,
    lastSegment: segments.at(-1) ?? null,
  };
}

const results = [];
for (const video of videos) {
  console.log(`[proof] starting ${video.label}: ${video.videoId}`);
  const result = await requestDomOnly(video.videoId);
  results.push(result);
  console.log(`[proof] ${video.label}`, JSON.stringify(result));
  if (video.videoId === "PolmvqSxnbc" && !result.ok) break;
}

console.log("DOM_PRIMARY_PROOF_RESULT=" + JSON.stringify({
  bridgeReady,
  sameExtensionInstance: true,
  domOnly,
  results,
}));

await context.close();

if (
  results.length !== videos.length ||
  results.some((result) => !result.ok || (domOnly && result.acquisitionSource !== "dom") || result.terminalCount !== 1)
) {
  process.exitCode = 1;
}
