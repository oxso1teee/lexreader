import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, "out/ext-profile");

console.log("=== Real browser extension test ===");
console.log("extension path:", extensionPath);

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

console.log("context launched. waiting for service worker...");

let worker = context.serviceWorkers()[0];
if (!worker) {
  worker = await context.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
}
console.log("service worker present:", !!worker);
if (worker) console.log("service worker url:", worker.url());

// Sanity: visit a real youtube.com page first (establishes real session cookies
// in this browser profile, and confirms the extension's host_permissions/content
// script don't error there).
const ytPage = await context.newPage();
await ytPage.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", { waitUntil: "domcontentloaded", timeout: 30000 });
console.log("youtube.com page loaded, title:", await ytPage.title());
await ytPage.close();

// Now the real LexReader page, where the content script injects.
const page = await context.newPage();
const consoleLogs = [];
page.on("console", (msg) => consoleLogs.push(`[console:${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleLogs.push(`[pageerror] ${err.message}`));

await page.goto("http://localhost:3000/library/new", { waitUntil: "domcontentloaded", timeout: 30000 });
console.log("LexReader page loaded:", page.url());

// Replicate exactly what youtube-import-form.tsx does: ping, then request transcript.
const bridgeResult = await page.evaluate(() => {
  return new Promise((resolve) => {
    const BRIDGE_SOURCE = "lexreader-youtube-bridge";
    let pingTimedOut = false;
    const pingTimeout = setTimeout(() => {
      pingTimedOut = true;
      resolve({ bridgeReady: false, reason: "ping_timeout" });
    }, 3000);

    function handlePing(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source === BRIDGE_SOURCE && data.type === "LEXREADER_YOUTUBE_BRIDGE_READY") {
        clearTimeout(pingTimeout);
        window.removeEventListener("message", handlePing);
        if (!pingTimedOut) resolve({ bridgeReady: true });
      }
    }
    window.addEventListener("message", handlePing);
    window.postMessage({ source: "lexreader-web", type: "LEXREADER_YOUTUBE_BRIDGE_PING" }, window.location.origin);
  });
});
console.log("bridge ping result:", JSON.stringify(bridgeResult));

if (bridgeResult.bridgeReady) {
  const transcriptResult = await page.evaluate((videoUrl) => {
    return new Promise((resolve) => {
      const BRIDGE_SOURCE = "lexreader-youtube-bridge";
      const requestId = crypto.randomUUID();
      const timeout = setTimeout(() => resolve({ ok: false, error: "request_timeout" }), 30000);

      function handleResponse(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data.source !== BRIDGE_SOURCE || data.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE" || data.requestId !== requestId) return;
        clearTimeout(timeout);
        window.removeEventListener("message", handleResponse);
        resolve({ ok: data.ok, transcript: data.transcript, error: data.error });
      }
      window.addEventListener("message", handleResponse);
      window.postMessage(
        { source: "lexreader-web", type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST", requestId, url: videoUrl, targetLanguage: "en" },
        window.location.origin,
      );
    });
  }, "https://www.youtube.com/watch?v=jNQXAC9IVRw");

  console.log("transcript request result ok:", transcriptResult.ok);
  if (transcriptResult.ok) {
    console.log("title:", transcriptResult.transcript?.title);
    console.log("languageCode:", transcriptResult.transcript?.languageCode);
    console.log("segments:", transcriptResult.transcript?.segments?.length);
    console.log("first 3 segments:", JSON.stringify(transcriptResult.transcript?.segments?.slice(0, 3)));
  } else {
    console.log("error:", transcriptResult.error);
  }
} else {
  console.log("bridge never became ready — skipping transcript request.");
}

console.log("--- page console/errors ---");
console.log(consoleLogs.join("\n"));

await context.close();
console.log("done.");
