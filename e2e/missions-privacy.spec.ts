import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

// M3 Slice 6 (Missions v1) — same regex-enforcement approach as
// language-twin-privacy.spec.ts, extended to every file that fires a
// mission_-prefixed event. Forbidden keys are the same closed list: never
// sentence/word/phrase/translation/correction/material-title/source-text/
// answer-text/free-form content — only enums, counts, and booleans (mostly
// mission_type, never a raw mission_id/UUID, per docs/ui/analytics-events.md).
test("analytics: Missions track() calls never pass mission/question/word content, only enums/counts/booleans", () => {
  const filesToScan = [
    "src/app/(app)/missions/[missionId]/mission-screen.tsx",
    "src/app/(app)/missions/[missionId]/grammar-runner.tsx",
    "src/app/(app)/home/today-analytics.tsx",
    "src/app/(app)/brain/[deckId]/review/session-complete.tsx",
  ];
  const forbiddenPattern =
    /\b(title|text|word|phrase|email|content|body|front|back|headword|query|translation|deck_?name|deck_?id|notes|context|sentence|explanation|suggestion|url|material|answer|prompt|option|mission_id)\s*:/i;

  let totalCalls = 0;
  for (const relPath of filesToScan) {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
    const trackCalls = source.match(/track\(\s*[^,)]+\s*(?:,\s*\{[\s\S]*?\})?\)/g) ?? [];
    const missionCalls = trackCalls.filter((c) => /"mission_/.test(c));
    totalCalls += missionCalls.length;
    for (const call of missionCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(forbiddenPattern);
    }
  }
  expect(totalCalls).toBeGreaterThan(0);
});

function seriousViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

for (const route of ["/missions", "/missions/history"]) {
  test(`${route} has no serious/critical axe violations`, async ({ page }) => {
    await login(page);
    await page.goto(route);
    const results = await new AxeBuilder({ page }).include("body").analyze();
    expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
  });
}
