import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, "out/rc-direct-profile-" + Date.now());

const PREVIEW_URL = process.argv[2];
const BYPASS_SECRET = process.argv[3];
const LABEL = process.argv[4] || "run";

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});
console.log(`[${LABEL}] context launched`);

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
console.log(`[${LABEL}] service worker present:`, !!worker);

const page = await context.newPage();
page.on("pageerror", (e) => console.log(`[${LABEL}][pageerror]`, e.message));

// Public page on the Preview origin -- no login needed. lexreader-bridge.js's
// manifest match pattern covers the whole origin, so this exercises the exact
// same handshake code youtube-import-form.tsx relies on, without the
// onboarding flow in the way.
await page.goto(`${PREVIEW_URL}/?x-vercel-protection-bypass=${BYPASS_SECRET}&x-vercel-set-bypass-cookie=true`, { waitUntil: "load", timeout: 30000 });
await page.goto(`${PREVIEW_URL}/login`, { waitUntil: "load", timeout: 30000 });
console.log(`[${LABEL}] location.href:`, await page.evaluate(() => window.location.href));
console.log(`[${LABEL}] location.origin:`, await page.evaluate(() => window.location.origin));

await page.waitForTimeout(1500); // let the content script's own announceReady() fire first

const probe = await page.evaluate(() => {
  return new Promise((resolve) => {
    let gotReady = false;
    const handler = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source === "lexreader-youtube-bridge" && event.data?.type === "LEXREADER_YOUTUBE_BRIDGE_READY") {
        gotReady = true;
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ source: "lexreader-web", type: "LEXREADER_YOUTUBE_BRIDGE_PING" }, window.location.origin);
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ gotReady });
    }, 2500);
  });
});
console.log(`[${LABEL}] PING -> READY handshake succeeded:`, probe.gotReady);

await context.close();
console.log(`[${LABEL}] done.`);
