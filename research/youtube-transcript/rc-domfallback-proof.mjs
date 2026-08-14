// Lifecycle bug (M3 Slice 12 RC #4) -- real proof script. Tests the exact
// user-reported case (PolmvqSxnbc, a 116-minute video with a large
// auto-generated English transcript) through the real unpacked extension
// against the live Preview, holds 30s+ past success to prove no overwrite,
// then imports a second, different video (jNQXAC9IVRw, the existing
// regression fixture) without reloading the extension.
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, "out/rc-domfallback-profile-" + Date.now());

const PREVIEW_URL = process.argv[2];
const BYPASS_SECRET = process.argv[3];
const VIDEO_A = process.argv[4] || "PolmvqSxnbc";
const VIDEO_B = process.argv[5] || "jNQXAC9IVRw";
const TARGET_LANG = process.argv[6] || "en";
const POST_SUCCESS_WAIT_MS = Number(process.argv[7] || 35_000);

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--disable-blink-features=AutomationControlled",
  ],
});
console.log("[domfallback] context launched");

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
console.log("[domfallback] service worker present:", !!worker);
if (worker) worker.on("console", (msg) => console.log("[domfallback][sw]", msg.text()));

const warm = await context.newPage();
await warm.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
await warm.waitForTimeout(1000);
await warm.close();

const page = await context.newPage();
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[LexReader:diag]")) console.log("[domfallback][page]", text);
});

await page.goto(`${PREVIEW_URL}/?x-vercel-protection-bypass=${BYPASS_SECRET}&x-vercel-set-bypass-cookie=true`, { waitUntil: "load", timeout: 30000 });
await page.goto(`${PREVIEW_URL}/login`, { waitUntil: "load", timeout: 30000 });
console.log("[domfallback] on:", await page.evaluate(() => location.href));

async function requestAndObserve(videoId, targetLanguage, observeMs) {
  return page.evaluate(
    ({ videoId, targetLanguage, observeMs }) => {
      return new Promise((resolve) => {
        const BRIDGE_SOURCE = "lexreader-youtube-bridge";
        const requestId = crypto.randomUUID();
        const events = [];
        const startedAt = Date.now();

        function handleResponse(event) {
          if (event.source !== window || event.origin !== window.location.origin) return;
          const data = event.data;
          if (!data || data.source !== BRIDGE_SOURCE || data.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE" || data.requestId !== requestId) return;
          events.push({
            atMs: Date.now() - startedAt,
            ok: data.ok,
            error: data.error ?? null,
            source: data.transcript?.source ?? null,
            segmentCount: data.transcript?.segments?.length ?? null,
            firstSegment: data.transcript?.segments?.[0] ?? null,
          });
        }
        window.addEventListener("message", handleResponse);
        window.postMessage(
          { source: "lexreader-web", type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST", requestId, url: `https://www.youtube.com/watch?v=${videoId}`, targetLanguage },
          window.location.origin,
        );

        setTimeout(() => {
          window.removeEventListener("message", handleResponse);
          resolve({ requestId, videoId, events });
        }, observeMs);
      });
    },
    { videoId, targetLanguage, observeMs },
  );
}

console.log(`[domfallback] === Video A (${VIDEO_A}, real reported video): requesting, observing for ${POST_SUCCESS_WAIT_MS}ms after first response ===`);
const resultA = await requestAndObserve(VIDEO_A, TARGET_LANG, POST_SUCCESS_WAIT_MS);
console.log(`[domfallback] Video A events received: ${resultA.events.length}`);
for (const ev of resultA.events) {
  console.log(`[domfallback] Video A event @${ev.atMs}ms: ok=${ev.ok} error=${ev.error} source=${ev.source} segments=${ev.segmentCount}`);
  if (ev.firstSegment) console.log(`[domfallback] Video A first segment: ${JSON.stringify(ev.firstSegment)}`);
}
const firstEventA = resultA.events[0];
const laterFailuresA = resultA.events.slice(1).filter((ev) => !ev.ok);
const successHeldA = !!firstEventA?.ok && laterFailuresA.length === 0;
console.log(`[domfallback] Video A: succeeded=${!!firstEventA?.ok} heldFor${POST_SUCCESS_WAIT_MS}ms=${successHeldA} segmentCount=${firstEventA?.segmentCount}`);

console.log(`[domfallback] === Video B (${VIDEO_B}): requesting immediately, WITHOUT reloading the extension or page ===`);
const resultB = await requestAndObserve(VIDEO_B, TARGET_LANG, 20_000);
console.log(`[domfallback] Video B events received: ${resultB.events.length}`);
for (const ev of resultB.events) {
  console.log(`[domfallback] Video B event @${ev.atMs}ms: ok=${ev.ok} error=${ev.error} source=${ev.source} segments=${ev.segmentCount}`);
}
const secondVideoSucceeded = !!resultB.events[0]?.ok;
console.log(`[domfallback] Video B succeeded without reload: ${secondVideoSucceeded}`);

console.log("[domfallback] === SUMMARY ===");
console.log(JSON.stringify({
  videoA: VIDEO_A,
  videoASucceededAndHeld: successHeldA,
  videoASegmentCount: firstEventA?.segmentCount ?? null,
  videoASource: firstEventA?.source ?? null,
  videoAEvents: resultA.events,
  videoB: VIDEO_B,
  videoBSucceeded: secondVideoSucceeded,
  videoBSegmentCount: resultB.events[0]?.segmentCount ?? null,
}, null, 2));

await context.close();
console.log("[domfallback] done.");
