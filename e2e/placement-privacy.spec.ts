import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

// M3 Slice 9 — same regex-enforcement approach as missions-privacy.spec.ts /
// learning-paths-privacy.spec.ts, extended to every file that fires an
// Onboarding + Placement v2 event (client track() calls in the wizard/result
// view, and the server-side captureServerEvent() calls in placement/result/
// learning-paths actions). Forbidden keys are the same closed list — question
// prompt/option text, free-text answers, and goal/CEFR/path/skill labels are
// never sent as free text, only as closed enum-like values under safe keys
// (goal, self_reported_cefr, question_id, difficulty_tier, result_range,
// confidence, path_slug, skill_key).
const FORBIDDEN_PATTERN =
  /\b(title|text|word|phrase|email|content|body|front|back|headword|query|translation|deck_?name|deck_?id|notes|context|sentence|explanation|suggestion|url|material|prompt|option|mission_id|evidence|reason|selected_index|selectedIndex)\s*:/i;

test("analytics: Onboarding + Placement v2 track()/captureServerEvent() calls never pass question/answer content, only enums/counts/booleans", () => {
  const filesToScan = [
    "src/app/onboarding/onboarding-wizard.tsx",
    "src/app/onboarding/placement/actions.ts",
    "src/app/onboarding/placement/page.tsx",
    "src/app/onboarding/result/result-view.tsx",
    "src/app/onboarding/result/actions.ts",
    "src/app/(app)/learning-paths/actions.ts",
  ];

  const ONBOARDING_EVENT_PREFIX =
    /"(onboarding_|placement_|recommended_path_viewed|learning_path_selected_from_onboarding)/;

  let totalCalls = 0;
  for (const relPath of filesToScan) {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
    const calls =
      source.match(/(?:track|captureServerEvent)\(\s*[^,)]+\s*,\s*(?:"[^"]*"|[^,)]+)\s*,?\s*\{[\s\S]*?\}\s*\)/g) ?? [];
    const onboardingCalls = calls.filter((c) => ONBOARDING_EVENT_PREFIX.test(c));
    totalCalls += onboardingCalls.length;
    for (const call of onboardingCalls) {
      expect(call, `${relPath}: ${call}`).not.toMatch(FORBIDDEN_PATTERN);
    }
  }
  expect(totalCalls).toBeGreaterThan(0);
});
