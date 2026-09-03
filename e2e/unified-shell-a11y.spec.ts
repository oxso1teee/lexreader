import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

test("Today has no serious/critical axe violations on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto("/home");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("Today has no serious/critical axe violations on mobile (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/home");

  const results = await new AxeBuilder({ page }).include("body").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("Today is keyboard-navigable: Tab reaches the primary CTA and nav links", async ({ page }) => {
  await login(page);
  await page.goto("/home");

  // Первый Tab уводит фокус с адресной строки браузера на страницу —
  // в headless Playwright фокус стартует на body, поэтому первый Tab уже
  // должен попасть на первый интерактивный элемент шапки/CTA.
  const focusedHrefs: string[] = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const href = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    if (href) focusedHrefs.push(href);
  }
  expect(focusedHrefs).toContain("/home");
  expect(focusedHrefs.some((h) => h.startsWith("/library") || h.startsWith("/brain") || h.startsWith("/read"))).toBe(
    true,
  );
});

test("visible focus outline is applied on nav links via real keyboard navigation", async ({ page }) => {
  await login(page);
  await page.goto("/home");

  // page.locator(...).focus() вызывает Element.focus() напрямую — в
  // Chromium это не всегда триггерит :focus-visible (эвристика ориентации
  // по "последнему вводу"), поэтому реальный Tab, а не программный .focus().
  let outline = "none";
  for (let i = 0; i < 20 && outline === "none"; i++) {
    await page.keyboard.press("Tab");
    outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el.getAttribute("href") !== "/home") return "none";
      return getComputedStyle(el).outlineStyle;
    });
  }
  expect(outline).not.toBe("none");
});

test("analytics: track() calls added in this slice never pass user content, only enums/routes/booleans", () => {
  const filesToScan = [
    "src/app/(app)/home/today-analytics.tsx",
    "src/components/product/today/hero-card.tsx",
    "src/components/product/app-shell/desktop-sidebar.tsx",
    "src/components/product/app-shell/mobile-bottom-nav.tsx",
    "src/components/product/today/continue-learning-card.tsx",
  ];
  // Блок-лист имён переменных/полей, которые могли бы протащить
  // пользовательский контент в свойства track() (docs/ui/analytics-events.md).
  const forbiddenPattern = /\b(title|text|word|phrase|email|content|body|front|back|headword)\s*:/i;

  for (const relPath of filesToScan) {
    const fullPath = path.join(__dirname, "..", relPath);
    const source = fs.readFileSync(fullPath, "utf8");
    const trackCalls = source.match(/track\(\s*"[^"]+"\s*,\s*\{[\s\S]*?\}\)/g) ?? [];
    for (const call of trackCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(forbiddenPattern);
    }
  }
});
