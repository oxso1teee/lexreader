import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULA, getAllPaths, getAllSkills, isValidSkillForPath } from "./index.ts";
import { buildGrammarQuestionSet, GRAMMAR_RUNNER_CATEGORIES } from "../../missions/grammar-bank.ts";

// M3 Slice 8 — structural validation for the static curriculum (plan doc
// §43). These are the guarantees the rest of the app (enrollment/progress/
// Knowledge Check) is allowed to assume hold for every shipped path.

test("CURRICULA: every path's slug matches its registry key", () => {
  for (const [key, path] of Object.entries(CURRICULA)) {
    assert.equal(path.slug, key);
  }
});

test("CURRICULA: every path has a positive version number", () => {
  for (const path of getAllPaths()) {
    assert.ok(Number.isInteger(path.version) && path.version > 0, path.slug);
  }
});

test("CURRICULA: stage keys are unique within each path", () => {
  for (const path of getAllPaths()) {
    const keys = path.stages.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, path.slug);
  }
});

test("CURRICULA: module keys are unique within each path", () => {
  for (const path of getAllPaths()) {
    const keys = path.stages.flatMap((s) => s.modules.map((m) => m.key));
    assert.equal(new Set(keys).size, keys.length, path.slug);
  }
});

test("CURRICULA: skill keys are unique within each path", () => {
  for (const path of getAllPaths()) {
    const keys = getAllSkills(path).map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, path.slug);
  }
});

test("CURRICULA: every stage has at least one module, every module at least one skill", () => {
  for (const path of getAllPaths()) {
    assert.ok(path.stages.length > 0, path.slug);
    for (const stage of path.stages) {
      assert.ok(stage.modules.length > 0, `${path.slug}/${stage.key}`);
      for (const mod of stage.modules) {
        assert.ok(mod.skills.length > 0, `${path.slug}/${stage.key}/${mod.key}`);
      }
    }
  }
});

test("CURRICULA: every skill has non-empty lesson content (objective/explanation/examples/commonMistakes)", () => {
  for (const path of getAllPaths()) {
    for (const skill of getAllSkills(path)) {
      assert.ok(skill.lesson.objective.length > 0, skill.key);
      assert.ok(skill.lesson.explanation.length > 0, skill.key);
      assert.ok(skill.lesson.examples.length > 0, skill.key);
      assert.ok(skill.lesson.commonMistakes.length > 0, skill.key);
    }
  }
});

// Catches a typo'd subTopic silently turning into an unintended
// "no coverage" gap — every subTopic used in curriculum must be a known
// one, whether or not the grammar bank currently has real questions for it
// (present_perfect/past_perfect/future_forms are deliberately in the bank's
// "not yet covered" set — see b1-b2.v1.ts).
const KNOWN_SUBTOPICS = new Set([
  "present_simple", "present_continuous", "past_simple",
  "present_perfect", "past_perfect", "future_forms",
]);

test("CURRICULA: every subTopic used is a known one (no silent typo)", () => {
  for (const path of getAllPaths()) {
    for (const skill of getAllSkills(path)) {
      if (skill.subTopic) assert.ok(KNOWN_SUBTOPICS.has(skill.subTopic), `${skill.key}: unknown subTopic "${skill.subTopic}"`);
    }
  }
});

test("CURRICULA: missionTypeHint is only ever set on a skill with no category (never contradicts a real category match)", () => {
  for (const path of getAllPaths()) {
    for (const skill of getAllSkills(path)) {
      if (skill.missionTypeHint) assert.equal(skill.category, null, skill.key);
    }
  }
});

test("CURRICULA: a skill's subTopic, when it has real grammar-bank coverage, actually resolves questions", () => {
  const coveredSubTopics = new Set(["present_simple", "present_continuous", "past_simple"]);
  for (const path of getAllPaths()) {
    for (const skill of getAllSkills(path)) {
      if (skill.category && skill.subTopic && coveredSubTopics.has(skill.subTopic)) {
        const questions = buildGrammarQuestionSet(skill.category, 5, "test-seed", skill.subTopic);
        assert.ok(questions.length > 0, `${skill.key}: expected real coverage for subTopic "${skill.subTopic}"`);
      }
    }
  }
});

test("CURRICULA: a skill's category, when set without a subTopic, is either grammar-bank covered or a targeted-practice category (never a silent dead end)", () => {
  const TARGETED_PRACTICE_CATEGORIES = new Set(["activation", "review_recall"]);
  for (const path of getAllPaths()) {
    for (const skill of getAllSkills(path)) {
      if (skill.category && !skill.subTopic) {
        const isGrammarBank = (GRAMMAR_RUNNER_CATEGORIES as string[]).includes(skill.category);
        const isTargeted = TARGETED_PRACTICE_CATEGORIES.has(skill.category);
        // collocation is a real, intentional exception: grammar-bank
        // deliberately excludes it (not a multiple-choice shape) and it's
        // not a targeted-practice category either — Practice-only by design.
        assert.ok(isGrammarBank || isTargeted || skill.category === "collocation", `${skill.key}: category "${skill.category}" has no practice path`);
      }
    }
  }
});

test("isValidSkillForPath: rejects an unknown skill_key, accepts a real one", () => {
  assert.equal(isValidSkillForPath("a2-b1", "grammar.articles"), true);
  assert.equal(isValidSkillForPath("a2-b1", "grammar.made_up_skill"), false);
  assert.equal(isValidSkillForPath("a2-b1", "grammar.present_perfect"), false); // that's a b1-b2 skill
});
