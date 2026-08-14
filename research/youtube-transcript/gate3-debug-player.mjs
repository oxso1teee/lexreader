import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, "out/gate3-profile");
const textId = process.argv[2];

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});
const page = await context.newPage();
page.on("console", (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("requestfailed", (req) => console.log("[requestfailed]", req.url(), req.failure()?.errorText));

await page.goto(`http://localhost:3000/watch/${textId}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

const diag = await page.evaluate(() => {
  const el = document.getElementById("yt-player");
  return {
    ytDefined: typeof window.YT,
    ytPlayerCtor: typeof window.YT?.Player,
    scriptTagPresent: !!document.querySelector('script[src="https://www.youtube.com/iframe_api"]'),
    ytPlayerDivHtml: el ? el.outerHTML.slice(0, 500) : "MISSING",
    onReadyCallbackType: typeof window.onYouTubeIframeAPIReady,
  };
});
console.log("diag:", JSON.stringify(diag, null, 2));

await page.waitForTimeout(6000);
const diag2 = await page.evaluate(() => {
  const el = document.getElementById("yt-player");
  return { ytDefined: typeof window.YT, ytPlayerDivHtml: el ? el.outerHTML.slice(0, 500) : "MISSING" };
});
console.log("diag2 (after 10s total):", JSON.stringify(diag2, null, 2));

await context.close();
