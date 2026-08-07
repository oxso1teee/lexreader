import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

// M3 Slice 5 — generalizes practice-brain-a11y.spec.ts's regex-enforcement
// approach (plan doc §10) to every Language Twin file that calls track().
// Forbidden keys mirror the brief's explicit list: sentence, corrected
// sentence, word, phrase, translation, context, evidence content, material
// title, URL, deck name, exact error, free-form text — never enums/counts/
// booleans-only, no exceptions for this feature.
test("analytics: Language Twin track() calls never pass sentence/word/evidence content, only enums/counts/booleans", () => {
  const filesToScan = [
    "src/app/(app)/language-twin/language-twin-analytics.tsx",
    "src/app/(app)/language-twin/strengths-list.tsx",
    "src/app/(app)/language-twin/recompute-button.tsx",
    "src/app/(app)/language-twin/enable-toggle-inline.tsx",
    "src/app/(app)/language-twin/recommendation-card.tsx",
    "src/app/(app)/language-twin/patterns/pattern-list-client.tsx",
    "src/app/(app)/language-twin/evidence/evidence-list-client.tsx",
    "src/app/(app)/language-twin/diagnostic/diagnostic-flow.tsx",
    "src/app/(app)/language-twin/correction/correction-form.tsx",
    "src/app/(app)/language-twin/settings/settings-form.tsx",
  ];
  const forbiddenPattern =
    /\b(title|text|word|phrase|email|content|body|front|back|headword|query|translation|deck_?name|deck_?id|notes|context|sentence|explanation|suggestion|url|material)\s*:/i;

  let totalCalls = 0;
  for (const relPath of filesToScan) {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
    const trackCalls = source.match(/track\(\s*[^,)]+\s*(?:,\s*\{[\s\S]*?\})?\)/g) ?? [];
    totalCalls += trackCalls.length;
    for (const call of trackCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(forbiddenPattern);
    }
  }
  expect(totalCalls).toBeGreaterThan(0);
});

function seriousViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

for (const route of [
  "/language-twin",
  "/language-twin/patterns",
  "/language-twin/evidence",
  "/language-twin/recommendations",
  "/language-twin/correction",
  "/language-twin/diagnostic",
  "/language-twin/settings",
]) {
  test(`${route} has no serious/critical axe violations`, async ({ page }) => {
    await login(page);
    await page.goto(route);
    const results = await new AxeBuilder({ page }).include("body").analyze();
    expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
  });
}
