import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

// M3 Slice 4.1: "color-contrast" used to be excluded here on purpose —
// text-black/40, /50 (the existing secondary-text convention) and
// text-caramel-as-text both failed WCAG AA on these surfaces. Both are now
// fixed on every Brain/Practice screen this spec visits (swapped for the
// axe-verified --text-secondary/--color-caramel-text tokens in
// src/styles/tokens.css; see also practice-modes-feedback.spec.ts for the
// related color-only-feedback fix in Choice/Type/Match). The exclusion is
// dropped so a real regression here fails loudly again. The same pattern
// may still exist on screens outside this spec's surface (Library, Reader,
// onboarding, pricing, etc.) — out of scope for this slice, tracked
// separately.
function seriousViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test("Practice Home has no serious/critical axe violations on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto("/brain");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Practice Home has no serious/critical axe violations on mobile (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/brain");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Vocabulary (Words tab) has no serious/critical axe violations on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto("/brain/vocabulary");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Vocabulary (Decks tab) has no serious/critical axe violations, incl. the New Deck modal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();

  let results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);

  await page.getByRole("button", { name: "+ Новая колода" }).click();
  await expect(page.getByPlaceholder("Название колоды...")).toBeVisible();

  results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Vocabulary has no serious/critical axe violations on mobile (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/brain/vocabulary");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Item Details sheet has no serious/critical axe violations", async ({ page }) => {
  await login(page);
  await page.goto("/brain/vocabulary");
  // "birds" is seeded (supabase/seed.sql) and kept due by e2e/global-setup.ts
  // (ensureDueCard), so it always exists on the default account regardless
  // of what other e2e runs added.
  await page.getByText("birds", { exact: true }).click();
  await expect(page.getByText("Статус повторения")).toBeVisible({ timeout: 10_000 });

  const results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Review Session has no serious/critical axe violations on desktop, question and revealed states", async ({
  page,
}) => {
  // Two full AxeBuilder().analyze() passes in one test occasionally outrun
  // Playwright's 30s default under CPU load (axe's DOM traversal cost, not
  // this app) — matches the same headroom already given to the
  // deck-creation redirect assertions elsewhere in this suite.
  test.setTimeout(60_000);
  // The revealed answer fades/flips in via the .flip-reveal CSS animation
  // (globals.css, 0.35s). Scanning mid-transition briefly composites the
  // dark: text color over the light-mode surface (or vice versa) and can
  // make axe measure a false-positive contrast failure on a slower runner —
  // this isn't a real a11y bug, so match what a prefers-reduced-motion user
  // actually sees (globals.css already skips the animation for them) rather
  // than racing a fixed sleep against CI's variable CPU load.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto("/brain/all/review");
  await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible({ timeout: 10_000 });

  let results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);

  await page.getByRole("button", { name: "Показать ответ" }).click();
  await expect(page.getByRole("button", { name: /Не помню/ })).toBeVisible();

  results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Review Session has no serious/critical axe violations on mobile (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/brain/all/review");
  await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible({ timeout: 10_000 });

  const results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("Review Session is keyboard-navigable: Space reveals, 1-4 grades, Escape exits with confirm", async ({
  page,
}) => {
  await login(page);
  await page.goto("/brain/all/review");
  await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible({ timeout: 10_000 });

  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /Не помню/ })).toBeVisible();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  // Dialog dismissed → session stays open, still on the same card.
  await expect(page.getByRole("button", { name: /Не помню/ })).toBeVisible();
});

test("Review Session keyboard shortcuts don't fire while editing a card", async ({ page }) => {
  await login(page);
  await page.goto("/brain/all/review");
  await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Редактировать карточку" }).click();
  const frontInput = page.locator('input[name="front"]');
  await expect(frontInput).toBeVisible();
  await frontInput.click();
  await page.keyboard.press("Space");
  // Space typed a literal space into the field, not toggled reveal/grade.
  await expect(frontInput).not.toHaveValue("");
  await expect(page.getByRole("button", { name: "Показать ответ" })).toHaveCount(0);
});

test("Deck Details page has no serious/critical axe violations", async ({ page }) => {
  test.setTimeout(45_000);
  await login(page);
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("link", { name: /Основная колода/ }).click();
  await expect(page).toHaveURL(/\/brain\/[\w-]+(\?created=true)?$/);

  const results = await new AxeBuilder({ page }).include("body").analyze();
  expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
});

test("analytics: Slice 4 Practice/Brain/Review track() calls never pass user content, only enums/routes/booleans", () => {
  const filesToScan = [
    "src/app/(app)/brain/practice-analytics.tsx",
    "src/app/(app)/brain/new-deck-modal.tsx",
    "src/app/(app)/brain/[deckId]/deck-analytics.tsx",
    "src/app/(app)/brain/[deckId]/review/review-session.tsx",
    "src/app/(app)/brain/vocabulary/vocabulary-browser.tsx",
  ];
  const forbiddenPattern =
    /\b(title|text|word|phrase|email|content|body|front|back|headword|query|translation|deck_?name|deck_?id|notes|context)\s*:/i;

  let totalCalls = 0;
  for (const relPath of filesToScan) {
    const fullPath = path.join(__dirname, "..", relPath);
    const source = fs.readFileSync(fullPath, "utf8");
    const trackCalls = source.match(/track\(\s*"[^"]+"\s*(?:,\s*\{[\s\S]*?\})?\)/g) ?? [];
    totalCalls += trackCalls.length;
    for (const call of trackCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(forbiddenPattern);
    }
  }
  expect(totalCalls).toBeGreaterThan(0);
});
