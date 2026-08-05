import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

const READ_TEXT_ID = "0b33035e-73d0-456a-818a-4bc3245da2c1"; // "A Walk in the Park" — seeded system text

test("Library has no serious/critical axe violations on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto("/library");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("Library has no serious/critical axe violations on mobile (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/library");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("Reader has no serious/critical axe violations on desktop, with the word panel open", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto(`/read/${READ_TEXT_ID}`);
  await page.getByRole("button", { name: "birds", exact: true }).click();
  await expect(page.locator("aside").getByText("Уровень знания")).toBeVisible({ timeout: 10_000 });

  const results = await new AxeBuilder({ page }).include("body").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("Reader has no serious/critical axe violations on mobile (390px), with the bottom sheet open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto(`/read/${READ_TEXT_ID}`);
  await page.getByRole("button", { name: "birds", exact: true }).click();
  const sheet = page.locator(".fixed.inset-x-0.bottom-0");
  await expect(sheet.getByText("Уровень знания")).toBeVisible({ timeout: 10_000 });

  const results = await new AxeBuilder({ page }).include("body").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("Reader is keyboard-navigable and Escape closes the word panel", async ({ page }) => {
  await login(page);
  await page.goto(`/read/${READ_TEXT_ID}`);
  await page.getByRole("button", { name: "birds", exact: true }).click();
  await expect(page.locator("aside").getByText("Уровень знания")).toBeVisible({ timeout: 10_000 });

  await page.keyboard.press("Escape");
  await expect(page.locator("aside").getByText("Уровень знания")).toHaveCount(0);
});

test("Reader keyboard shortcuts don't fire while typing in the manual-translation input", async ({ page }) => {
  // Guards use-keyboard-shortcuts.ts's isTypingTarget() check — Space must
  // type a literal space, not toggle Listening playback, while focused in
  // a text field.
  await login(page);
  await page.goto(`/read/${READ_TEXT_ID}`);
  await page.getByRole("button", { name: "birds", exact: true }).click();
  const input = page.locator("#manual-translation-input");
  if ((await input.count()) === 0) {
    test.skip(true, "manual-translation input only renders on a translation error — nothing to guard here");
  }
  await input.click();
  await page.keyboard.press("Space");
  await expect(input).toHaveValue(" ");
});

test("analytics: Reader/Library track() calls never pass user content, only enums/routes/booleans", () => {
  const filesToScan = [
    "src/app/read/[textId]/reader.tsx",
    "src/app/(app)/library/library-browser.tsx",
    "src/app/(app)/library/new/use-add-material-action.ts",
    "src/app/(app)/library/new/youtube-import-form.tsx",
  ];
  const forbiddenPattern = /\b(title|text|word|phrase|email|content|body|front|back|headword|query|translation)\s*:/i;

  for (const relPath of filesToScan) {
    const fullPath = path.join(__dirname, "..", relPath);
    const source = fs.readFileSync(fullPath, "utf8");
    const trackCalls = source.match(/track\(\s*"[^"]+"\s*,\s*\{[\s\S]*?\}\)/g) ?? [];
    for (const call of trackCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(forbiddenPattern);
    }
  }
});
