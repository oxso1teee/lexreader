import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

// M3 Slice 8 — same regex-enforcement approach as language-twin-privacy.spec.ts
// / missions-privacy.spec.ts, extended to every file that fires a Learning
// Paths event (client track() calls, view-tracker JSX props, and the
// server-side captureServerEvent() calls in actions.ts). Forbidden keys are
// the same closed list plus the plan doc's explicit ban on raw sentence/
// word/answer/material content and Language Twin evidence content —
// path_slug/skill_key/stage_key are closed enum-like strings from the
// static curriculum registry, never free text.
const FORBIDDEN_PATTERN =
  /\b(title|text|word|phrase|email|content|body|front|back|headword|query|translation|deck_?name|deck_?id|notes|context|sentence|explanation|suggestion|url|material|answer|prompt|option|mission_id|evidence|reason)\s*:/i;

test("analytics: Learning Paths track()/captureServerEvent() calls never pass lesson/question/evidence content, only enums/counts/booleans", () => {
  const filesToScan = [
    "src/app/(app)/learning-paths/path-actions.tsx",
    "src/app/(app)/learning-paths/[pathSlug]/[stageKey]/[skillKey]/lesson-actions.tsx",
    "src/app/(app)/learning-paths/[pathSlug]/[stageKey]/[skillKey]/check/check-runner.tsx",
    "src/app/(app)/learning-paths/actions.ts",
  ];

  let totalCalls = 0;
  for (const relPath of filesToScan) {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
    const calls = source.match(/(?:track|captureServerEvent)\(\s*[^,)]+\s*,\s*(?:"[^"]*"|[^,)]+)\s*,?\s*\{[\s\S]*?\}\s*\)/g) ?? [];
    const learningPathCalls = calls.filter((c) => /"(learning_path|stage|skill|lesson|knowledge_check)_/.test(c));
    totalCalls += learningPathCalls.length;
    for (const call of learningPathCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(FORBIDDEN_PATTERN);
    }
  }
  expect(totalCalls).toBeGreaterThan(0);
});

test("analytics: LearningPathsViewTracker props never pass lesson content, only enums", () => {
  const filesToScan = [
    "src/app/(app)/learning-paths/page.tsx",
    "src/app/(app)/learning-paths/[pathSlug]/page.tsx",
    "src/app/(app)/learning-paths/[pathSlug]/[stageKey]/page.tsx",
    "src/app/(app)/learning-paths/[pathSlug]/[stageKey]/[skillKey]/page.tsx",
    "src/app/(app)/learning-paths/[pathSlug]/[stageKey]/[skillKey]/check/page.tsx",
  ];

  let totalCalls = 0;
  for (const relPath of filesToScan) {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
    const calls = source.match(/<LearningPathsViewTracker[\s\S]*?\/>/g) ?? [];
    totalCalls += calls.length;
    for (const call of calls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(FORBIDDEN_PATTERN);
    }
  }
  expect(totalCalls).toBeGreaterThan(0);
});

function seriousViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

for (const route of ["/learning-paths", "/learning-paths/a2-b1"]) {
  test(`${route} has no serious/critical axe violations`, async ({ page }) => {
    await login(page);
    await page.goto(route);
    const results = await new AxeBuilder({ page }).include("body").analyze();
    expect(seriousViolations(results), JSON.stringify(seriousViolations(results), null, 2)).toEqual([]);
  });
}
