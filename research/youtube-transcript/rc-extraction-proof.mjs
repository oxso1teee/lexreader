import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, "out/rc-extraction-profile-" + Date.now());

const PREVIEW_URL = process.argv[2];
const BYPASS_SECRET = process.argv[3];
const VIDEO_URL = process.argv[4];
const TARGET_LANG = process.argv[5] || "en";
const LABEL = process.argv[6] || "run";

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--disable-blink-features=AutomationControlled",
  ],
});
console.log(`[${LABEL}] context launched`);

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
console.log(`[${LABEL}] service worker present:`, !!worker);
if (worker) {
  worker.on("console", (msg) => console.log(`[${LABEL}][sw]`, msg.text()));
}

// Warm-up (Gate #2C finding): a fresh automated profile's first-ever
// youtube.com visit behaves differently than a real user's already-used
// browser.
const warm = await context.newPage();
await warm.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
await warm.waitForTimeout(1000);
await warm.close();

const page = await context.newPage();
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[LexReader:diag]")) console.log(`[${LABEL}][page]`, text);
});

// The bridge's message contract lives entirely in lexreader-bridge.js,
// which injects on ANY page under an allowed origin -- /login renders fast
// and reliably, and directly exercises the exact same
// LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST/RESPONSE contract
// youtube-import-form.tsx uses on /library/new, without depending on this
// account's onboarding progress (irrelevant to the extraction fix itself).
await page.goto(`${PREVIEW_URL}/?x-vercel-protection-bypass=${BYPASS_SECRET}&x-vercel-set-bypass-cookie=true`, { waitUntil: "load", timeout: 30000 });
await page.goto(`${PREVIEW_URL}/login`, { waitUntil: "load", timeout: 30000 });
console.log(`[${LABEL}] on:`, await page.evaluate(() => location.href));

const start = Date.now();
const result = await page.evaluate((args) => {
  return new Promise((resolve) => {
    const BRIDGE_SOURCE = "lexreader-youtube-bridge";
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => resolve({ ok: false, error: "test_harness_timeout" }), 60000);
    function handleResponse(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== BRIDGE_SOURCE || data.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE" || data.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handleResponse);
      resolve(data);
    }
    window.addEventListener("message", handleResponse);
    window.postMessage(
      { source: "lexreader-web", type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST", requestId, url: args.videoUrl, targetLanguage: args.targetLanguage },
      window.location.origin,
    );
  });
}, { videoUrl: VIDEO_URL, targetLanguage: TARGET_LANG });

const elapsedMs = Date.now() - start;
console.log(`[${LABEL}] result ok:`, result.ok, "elapsedMs:", elapsedMs);
if (result.ok) {
  console.log(`[${LABEL}] transcript videoId:`, result.transcript?.videoId);
  console.log(`[${LABEL}] transcript title:`, result.transcript?.title);
  console.log(`[${LABEL}] transcript languageCode:`, result.transcript?.languageCode);
  console.log(`[${LABEL}] transcript source:`, result.transcript?.source);
  console.log(`[${LABEL}] transcript segments:`, result.transcript?.segments?.length);
  console.log(`[${LABEL}] first segment:`, JSON.stringify(result.transcript?.segments?.[0]));
  console.log(`[${LABEL}] last segment:`, JSON.stringify(result.transcript?.segments?.[result.transcript.segments.length - 1]));
} else {
  console.log(`[${LABEL}] error:`, result.error, result.message);
}

await context.close();
console.log(`[${LABEL}] done.`);
