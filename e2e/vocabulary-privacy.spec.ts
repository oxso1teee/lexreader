import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

// M3 Slice 10 (Vocabulary & Phrase System v2, task #281) — same regex-enforcement approach as
// missions-privacy.spec.ts. No new track() events were added by this slice (see
// docs/ui/analytics-events.md's "M3 Slice 10" section) — this asserts the existing
// vocabulary_viewed/vocabulary_filter_changed/vocabulary_bulk_action_used calls stay closed-enum
// even though their value sets grew (item_type/learning_state filters), and that the new Context
// Gap mode never introduces a leak either.
test("analytics: Vocabulary track() calls never pass word/phrase/context content, only enums/counts/booleans", () => {
  const filesToScan = [
    "src/app/(app)/brain/vocabulary/vocabulary-browser.tsx",
    "src/app/(app)/brain/vocabulary/[id]/detail-view.tsx",
    "src/app/(app)/brain/[deckId]/review/context-gap-mode.tsx",
  ];
  const forbiddenPattern =
    /\b(title|text|word|phrase|email|content|body|front|back|headword|query|translation|deck_?name|deck_?id|notes|context|sentence|explanation|suggestion|url|material|answer|prompt|option)\s*:/i;

  let totalCalls = 0;
  for (const relPath of filesToScan) {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
    const trackCalls = source.match(/track\(\s*[^,)]+\s*(?:,\s*\{[\s\S]*?\})?\)/g) ?? [];
    const vocabCalls = trackCalls.filter((c) => /"vocabulary_/.test(c));
    totalCalls += vocabCalls.length;
    for (const call of vocabCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(forbiddenPattern);
    }
  }
  expect(totalCalls).toBeGreaterThan(0);
});

// Context Gap intentionally fires zero track() events (same "no per-answer event" convention as
// Choice/Type/Match, see analytics-events.md) — asserted directly so a future accidental addition
// there gets the same regex scrutiny as everywhere else, not silently skipped.
test("analytics: Context Gap mode fires no track() calls of its own", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/(app)/brain/[deckId]/review/context-gap-mode.tsx"),
    "utf-8",
  );
  expect(source.match(/\btrack\(/g)).toBeNull();
});

function seriousViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

for (const route of ["/brain/vocabulary", "/brain/all/review?mode=context", "/progress"]) {
  test(`${route} has no serious/critical axe violations`, async ({ page }) => {
    await login(page);
    await page.goto(route);
    const results = await new AxeBuilder({ page }).include("body").analyze();
    expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
  });
}
