// Lifecycle bug (M3 Slice 12 RC #3) -- real proof script. Unlike
// rc-extraction-proof.mjs (which resolves and exits on the FIRST response),
// this script keeps listening for LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE
// messages for the SAME requestId for a long window after the first
// success, specifically to prove nothing later overwrites it. It then
// immediately (no reload) imports a second, different video to prove no
// poisoned state carries over.
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, "out/rc-lifecycle-profile-" + Date.now());

const PREVIEW_URL = process.argv[2];
const BYPASS_SECRET = process.argv[3];
const VIDEO_A = process.argv[4] || "jNQXAC9IVRw";
const VIDEO_B = process.argv[5] || "aircAruvnKk";
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
console.log("[lifecycle] context launched");

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
console.log("[lifecycle] service worker present:", !!worker);
if (worker) {
  worker.on("console", (msg) => console.log("[lifecycle][sw]", msg.text()));
}

const warm = await context.newPage();
await warm.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
await warm.waitForTimeout(1000);
await warm.close();

const page = await context.newPage();
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[LexReader:diag]")) console.log("[lifecycle][page]", text);
});

await page.goto(`${PREVIEW_URL}/?x-vercel-protection-bypass=${BYPASS_SECRET}&x-vercel-set-bypass-cookie=true`, { waitUntil: "load", timeout: 30000 });
await page.goto(`${PREVIEW_URL}/login`, { waitUntil: "load", timeout: 30000 });
console.log("[lifecycle] on:", await page.evaluate(() => location.href));

/**
 * Sends a real LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST and, for the given
 * observeMs window, records EVERY LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE that
 * arrives for that exact requestId (not just the first) -- this is what
 * lets the caller prove "first valid result wins": if a second, different
 * (and especially a failing) response for the SAME requestId shows up
 * later, that's the exact bug being tested for.
 */
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
            segmentCount: data.transcript?.segments?.length ?? null,
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

console.log(`[lifecycle] === Video A (${VIDEO_A}): requesting and observing for ${POST_SUCCESS_WAIT_MS}ms after the first response ===`);
const startA = Date.now();
const resultA = await requestAndObserve(VIDEO_A, TARGET_LANG, POST_SUCCESS_WAIT_MS);
const elapsedA = Date.now() - startA;
console.log(`[lifecycle] Video A total observation window: ${elapsedA}ms, events received: ${resultA.events.length}`);
for (const ev of resultA.events) {
  console.log(`[lifecycle] Video A event @${ev.atMs}ms: ok=${ev.ok} error=${ev.error} segments=${ev.segmentCount}`);
}

const firstEventA = resultA.events[0];
const laterFailuresA = resultA.events.slice(1).filter((ev) => !ev.ok);
const success30sHeld = !!firstEventA?.ok && laterFailuresA.length === 0;

console.log(`[lifecycle] Video A: first event ok=${firstEventA?.ok}, later failure events=${laterFailuresA.length}, HELD FOR ${POST_SUCCESS_WAIT_MS}ms=${success30sHeld}`);

console.log(`[lifecycle] === Video B (${VIDEO_B}): requesting immediately, WITHOUT reloading the extension or page ===`);
const startB = Date.now();
const resultB = await requestAndObserve(VIDEO_B, TARGET_LANG, 20_000);
const elapsedB = Date.now() - startB;
console.log(`[lifecycle] Video B total observation window: ${elapsedB}ms, events received: ${resultB.events.length}`);
for (const ev of resultB.events) {
  console.log(`[lifecycle] Video B event @${ev.atMs}ms: ok=${ev.ok} error=${ev.error} segments=${ev.segmentCount}`);
}
const secondVideoSucceeded = !!resultB.events[0]?.ok;
console.log(`[lifecycle] Video B succeeded without reload: ${secondVideoSucceeded}`);

console.log("[lifecycle] === SUMMARY ===");
console.log(JSON.stringify({
  videoA: VIDEO_A,
  videoASucceededAndHeld: success30sHeld,
  videoAEvents: resultA.events,
  videoB: VIDEO_B,
  videoBSucceededWithoutReload: secondVideoSucceeded,
  videoBEvents: resultB.events,
}, null, 2));

await context.close();
console.log("[lifecycle] done.");
