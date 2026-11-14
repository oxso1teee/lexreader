import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULA, findSkill } from "../learning-paths/curriculum/index.ts";
import { emptySkillProgress } from "../learning-paths/progress-engine.ts";
import type { SkillProgressRow } from "../learning-paths/types.ts";
import { buildLessonPlan } from "./plan.ts";
import { LESSON_BASE_XP, LESSON_PERFECT_BONUS_XP, evaluateAttempt, lessonXp, passThreshold, planProgressUpdate } from "./scoring.ts";
import type { LessonPlan, StoredAnswer } from "./types.ts";

const NOW = "2026-01-01T00:00:00.000Z";
const skill = findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!;
const lessonPlan = buildLessonPlan(skill, "lesson")!; // 5 вопросов + 2 «собери»
const checkPlan = buildLessonPlan(skill, "check")!; // 5 вопросов

function answers(plan: LessonPlan, correctFlags: boolean[]): StoredAnswer[] {
  return plan.exerciseOrder.map((exerciseId, i) => ({
    exerciseId,
    response: { type: "choice", index: 0 },
    correct: correctFlags[i] ?? false,
    at: NOW,
  }));
}

function row(overrides: Partial<SkillProgressRow> = {}): SkillProgressRow {
  return { id: "r1", created_at: NOW, updated_at: NOW, ...emptySkillProgress("u1", CURRICULA["a2-b1"], skill.key), ...overrides };
}

test("lessonXp: базовая награда и бонус за урок без ошибок", () => {
  assert.equal(lessonXp(3, 5), LESSON_BASE_XP);
  assert.equal(lessonXp(5, 5), LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
  assert.equal(lessonXp(0, 0), LESSON_BASE_XP, "урок без упражнений — без бонуса «идеально»");
});

test("пороги зачёта: урок — 50%, быстрая проверка — 80%", () => {
  assert.equal(passThreshold("lesson"), 0.5);
  assert.equal(passThreshold("check"), 0.8);
});

test("evaluateAttempt: урок зачитывается с половины правильных, проверка — с 80%", () => {
  const n = lessonPlan.exerciseOrder.length; // 7
  const half = Math.ceil(n / 2);
  const flags = (k: number) => Array.from({ length: n }, (_, i) => i < k);
  assert.equal(evaluateAttempt(lessonPlan, answers(lessonPlan, flags(half))).passed, true);
  assert.equal(evaluateAttempt(lessonPlan, answers(lessonPlan, flags(half - 1))).passed, false);

  const m = checkPlan.exerciseOrder.length; // 5
  const checkFlags = (k: number) => Array.from({ length: m }, (_, i) => i < k);
  assert.equal(evaluateAttempt(checkPlan, answers(checkPlan, checkFlags(4))).passed, true, "4/5 = 80%");
  assert.equal(evaluateAttempt(checkPlan, answers(checkPlan, checkFlags(3))).passed, false, "3/5 = 60% — не засчитывает урок");
  assert.equal(evaluateAttempt(checkPlan, answers(checkPlan, checkFlags(3))).bucket, "mixed");
});

test("evaluateAttempt: урок без упражнений зачитывается, оценки нет", () => {
  const reading = buildLessonPlan(findSkill(CURRICULA["a2-b1"], "vocabulary.active_recall")!, "lesson")!;
  const result = evaluateAttempt(reading, []);
  assert.deepEqual(result, { total: 0, correct: 0, incorrect: 0, scoreRatio: null, bucket: null, passed: true });
});

test("evaluateAttempt: неизвестные и повторяющиеся ответы не искажают счёт", () => {
  const base = answers(checkPlan, [true, true, false, false, false]);
  const noisy: StoredAnswer[] = [...base, { ...base[0] }, { exerciseId: "ghost", response: { type: "choice", index: 0 }, correct: true, at: NOW }];
  const result = evaluateAttempt(checkPlan, noisy);
  assert.equal(result.correct, 2);
  assert.equal(result.incorrect, 3);
});

// ---------- прогресс навыка ----------

test("прогресс: сильный результат — урок пройден и навык confident/high", () => {
  const evaluation = evaluateAttempt(checkPlan, answers(checkPlan, [true, true, true, true, true]));
  const { patch, newlyCompleted } = planProgressUpdate(row(), { evaluation, masteryEligible: true, now: NOW });
  assert.equal(newlyCompleted, true);
  assert.equal(patch.status, "confident");
  assert.equal(patch.confidence, "high");
  assert.equal(patch.content_completed_at, NOW);
  assert.equal(patch.knowledge_check_best_score, 1);
});

test("прогресс: средний результат в уроке — пройден и practicing/medium", () => {
  const evaluation = evaluateAttempt(lessonPlan, answers(lessonPlan, [true, true, true, true, false, false, false]));
  assert.equal(evaluation.passed, true);
  const { patch, newlyCompleted } = planProgressUpdate(row(), { evaluation, masteryEligible: true, now: NOW });
  assert.equal(newlyCompleted, true);
  assert.equal(patch.status, "practicing");
  assert.equal(patch.confidence, "medium");
  assert.equal(patch.content_completed_at, NOW);
});

test("прогресс: слабый результат не засчитывает урок, но фиксирует попытку", () => {
  const evaluation = evaluateAttempt(lessonPlan, answers(lessonPlan, [true, false, false, false, false, false, false]));
  const { patch, newlyCompleted } = planProgressUpdate(row(), { evaluation, masteryEligible: true, now: NOW });
  assert.equal(newlyCompleted, false);
  assert.equal(patch.content_completed_at, undefined);
  assert.equal(patch.status, "introduced");
  assert.equal(patch.last_practiced_at, NOW);
});

test("прогресс: слабый результат при повторе НЕ понижает достигнутый статус и не стирает дату прохождения", () => {
  const done = row({ status: "confident", confidence: "high", content_completed_at: "2025-12-01T00:00:00.000Z", knowledge_check_best_score: 1 });
  const evaluation = evaluateAttempt(lessonPlan, answers(lessonPlan, [false, false, false, false, false, false, false]));
  const { patch, newlyCompleted } = planProgressUpdate(done, { evaluation, masteryEligible: true, now: NOW });
  assert.equal(newlyCompleted, false);
  assert.equal(patch.status, undefined, "статус не понижается");
  assert.equal(patch.confidence, undefined);
  assert.equal(patch.content_completed_at, undefined);
  assert.equal(patch.knowledge_check_best_score, 1, "лучший результат не уменьшается");
});

test("прогресс: повторное зачтённое прохождение не считается новым завершением и не переписывает дату", () => {
  const done = row({ status: "practicing", confidence: "medium", content_completed_at: "2025-12-01T00:00:00.000Z" });
  const evaluation = evaluateAttempt(checkPlan, answers(checkPlan, [true, true, true, true, true]));
  const { patch, newlyCompleted } = planProgressUpdate(done, { evaluation, masteryEligible: true, now: NOW });
  assert.equal(newlyCompleted, false);
  assert.equal(patch.content_completed_at, undefined);
  assert.equal(patch.status, "confident", "но уверенность честно растёт");
});

test("прогресс: без вопросов банка (masteryEligible=false) уверенность не меняется — только introduced и дата", () => {
  const topic = buildLessonPlan(findSkill(CURRICULA.everyday, "topic.small_talk")!, "lesson")!;
  const evaluation = evaluateAttempt(topic, answers(topic, topic.exerciseOrder.map(() => true)));
  const { patch, newlyCompleted } = planProgressUpdate(row(), { evaluation, masteryEligible: false, now: NOW });
  assert.equal(newlyCompleted, true);
  assert.equal(patch.status, "introduced");
  assert.equal(patch.confidence, undefined, "никакой фальшивой уверенности по паре «собери предложение»");
  assert.equal(patch.knowledge_check_best_score, undefined);
  assert.equal(patch.content_completed_at, NOW);
});

test("прогресс: быстрая проверка 60% не засчитывает урок, но ставит practicing", () => {
  const evaluation = evaluateAttempt(checkPlan, answers(checkPlan, [true, true, true, false, false]));
  const { patch, newlyCompleted } = planProgressUpdate(row(), { evaluation, masteryEligible: true, now: NOW });
  assert.equal(newlyCompleted, false);
  assert.equal(patch.content_completed_at, undefined);
  assert.equal(patch.status, "practicing");
});

test("прогресс: читательский урок без упражнений — introduced и дата, без оценки", () => {
  const reading = buildLessonPlan(findSkill(CURRICULA["a2-b1"], "vocabulary.active_recall")!, "lesson")!;
  const evaluation = evaluateAttempt(reading, []);
  const { patch, newlyCompleted } = planProgressUpdate(row(), { evaluation, masteryEligible: reading.masteryEligible, now: NOW });
  assert.equal(newlyCompleted, true);
  assert.deepEqual(Object.keys(patch).sort(), ["content_completed_at", "status"]);
  assert.equal(patch.status, "introduced");
});
