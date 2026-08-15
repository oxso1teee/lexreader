import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../browser-extension");
const userDataDir = path.resolve(__dirname, `out/gate3-profile-${Date.now()}`);

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
if (!EMAIL || !PASSWORD) {
  console.error("usage: node gate3-e2e.mjs <email> <password>");
  process.exit(1);
}

const ONLY_LONG = process.argv[4] === "--only-long";
const ONLY_SHORT = process.argv[4] === "--only-short";
const IMPORT_ONLY = process.argv.includes("--import-only");
const VIDEOS = ONLY_LONG
  ? [{ url: "https://www.youtube.com/watch?v=aircAruvnKk", label: "longer (18.7min, 3Blue1Brown)" }]
  : ONLY_SHORT
    ? [{ url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", label: "short (19s, Me at the zoo)" }]
  : [
      { url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", label: "short (19s, Me at the zoo)" },
      { url: "https://www.youtube.com/watch?v=aircAruvnKk", label: "longer (18.7min, 3Blue1Brown)" },
    ];

const env = Object.fromEntries(
  readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--disable-blink-features=AutomationControlled",
  ],
});
console.log("context launched");

// Warm-up (Gate #2C finding): a fresh automated profile's first-ever youtube.com visit behaves
// differently than a real user's already-used browser.
const warm = await context.newPage();
await warm.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", { waitUntil: "commit", timeout: 30000 });
const rejectCookies = await warm.waitForFunction(() => [...document.querySelectorAll("button")].find((button) => {
  const label = `${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`;
  return /Reject all|Reject the use of cookies|Отклонить все/i.test(label);
}) ?? null, null, { timeout: 25_000 }).catch(() => null);
if (rejectCookies) await rejectCookies.evaluate((button) => button.click());
await warm.waitForTimeout(1000);
await warm.close();

const page = await context.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("requestfailed", (req) => console.log("[requestfailed]", req.url(), req.failure()?.errorText));

// --- Login (skip if this persistent profile is already authenticated) ---
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home)?$/, { timeout: 15000 }).catch(() => {});
}
console.log("logged in, url:", page.url());

for (const video of VIDEOS) {
  console.log(`\n=== Importing ${video.label} ===`);
  await page.goto("http://localhost:3000/library/new", { waitUntil: "domcontentloaded" });
  const youtubeTab = page.getByRole("tab", { name: "YouTube", exact: true });
  await youtubeTab.waitFor({ state: "visible", timeout: 10000 });
  let selected = "false";
  for (let attempt = 0; attempt < 5; attempt++) {
    await youtubeTab.click({ force: true });
    await page.waitForTimeout(400);
    selected = (await youtubeTab.getAttribute("aria-selected")) ?? "false";
    console.log(`tab click attempt ${attempt}, aria-selected=${selected}`);
    if (selected === "true") break;
  }
  await page.waitForSelector("#youtube-import-url", { timeout: 10000 });
  await page.waitForFunction(
    () => document.body.innerText.includes("LexReader Bridge подключён"),
    { timeout: 10000 },
  );
  console.log("bridge ready");

  await page.fill("#youtube-import-url", video.url);
  await page.click('button:has-text("Импортировать субтитры")');
  await page.waitForURL(/\/watch\//, { timeout: 110000 });
  const textId = page.url().split("/watch/")[1];
  console.log("imported, textId:", textId);

  const [{ data: persistedText, error: textError }, { count: persistedSegmentCount, error: segmentsError }] = await Promise.all([
    supabaseAdmin
      .from("texts")
      .select("id, source_type, source_url")
      .eq("id", textId)
      .single(),
    supabaseAdmin
      .from("caption_segments")
      .select("id", { count: "exact", head: true })
      .eq("text_id", textId),
  ]);
  if (textError || segmentsError || !persistedText || !persistedSegmentCount) {
    throw new Error(`persistence verification failed: ${textError?.message ?? segmentsError?.message ?? "no caption rows"}`);
  }
  console.log("DB_PERSISTENCE=" + JSON.stringify({
    textId,
    sourceType: persistedText.source_type,
    sourceUrl: persistedText.source_url,
    captionSegments: persistedSegmentCount,
  }));

  // --- Reader loads, player + transcript render ---
  await page.waitForSelector("iframe#yt-player", { timeout: 15000 });
  console.log("yt-player iframe present");
  const segCount = await page.locator('p[class*="leading-relaxed"]').count();
  console.log("rendered transcript rows:", segCount);

  if (IMPORT_ONLY) {
    console.log(`TEXT_ID=${textId}`);
    continue;
  }

  // --- click-to-seek on the 2nd (or last, for short videos) segment ---
  const seekIdx = Math.min(2, segCount - 1);
  const seekButtons = page.locator('button[aria-label^="Перейти к"]');
  const targetLabel = await seekButtons.nth(seekIdx).getAttribute("aria-label");
  await seekButtons.nth(seekIdx).click();
  await page.waitForTimeout(1500);
  const clickedRowClass = await seekButtons.nth(seekIdx).locator("xpath=..").getAttribute("class");
  console.log(`clicked "${targetLabel}", its row is now active:`, (clickedRowClass ?? "").includes("forest-tint"));

  // --- word tap + save ---
  const firstWordBtn = page.locator('p[class*="leading-relaxed"] button').first();
  const wordText = (await firstWordBtn.textContent())?.trim();
  await firstWordBtn.click();
  await page.waitForSelector("text=Переводим…", { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(
    () => !document.body.innerText.includes("Переводим…"),
    { timeout: 15000 },
  );
  const popupError = await page.locator('[role="status"] [role="alert"]').count();
  console.log(`tapped word "${wordText}", popup resolved, error visible:`, popupError > 0);

  // --- phrase select (long-press drag across two adjacent words) ---
  const words = page.locator('p[class*="leading-relaxed"]').first().locator("button");
  const wordCount = await words.count();
  if (wordCount >= 2) {
    const box1 = await words.nth(0).boundingBox();
    const box2 = await words.nth(1).boundingBox();
    if (box1 && box2) {
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(600); // clear the 450ms long-press threshold
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForFunction(
        () => !document.body.innerText.includes("Переводим…"),
        { timeout: 15000 },
      );
      const savePhraseBtn = page.locator('button:has-text("Сохранить фразу")').first();
      if (await savePhraseBtn.count()) {
        await savePhraseBtn.click();
        console.log("phrase selection + save attempted");
      } else {
        console.log("phrase panel not showing a save button (selection may have collapsed to a single word)");
      }
    }
  }

  await page.waitForTimeout(1000);

  // --- leave and resume ---
  await page.goto("http://localhost:3000/library", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.goto(`http://localhost:3000/watch/${textId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("iframe#yt-player", { timeout: 15000 });
  await page.waitForTimeout(800);
  const activeRowAfterResume = await page.locator("p.text-base.font-medium").count();
  console.log("after reload, an active (resumed) row is highlighted:", activeRowAfterResume > 0);

  console.log(`TEXT_ID=${textId}`);
}

await context.close();
console.log("\ndone.");
