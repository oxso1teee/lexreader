import {
  KNOWLEDGE_CHECK_MIXED_THRESHOLD,
  KNOWLEDGE_CHECK_STRONG_THRESHOLD,
  applyKnowledgeCheckResult,
  applyLessonCompletion,
  scoreKnowledgeCheck,
  type KnowledgeCheckOutcome,
} from "../learning-paths/progress-engine.ts";
import type { SkillProgressRow } from "../learning-paths/types.ts";
import type { LessonMode, LessonPlan, StoredAnswer } from "./types.ts";

// Оценка попытки, награда и изменение прогресса навыка. Чистые функции:
// порог зачёта, размер XP и «что записать в user_skill_progress» меняются
// здесь и проверяются тестами, а не размазаны по серверному коду.

// ---------- Награда ----------

// Размер награды — в xp-rules.ts (на него же опирается каталог источников XP).
export { LESSON_BASE_XP, LESSON_PERFECT_BONUS_XP, lessonXp } from "./xp-rules.ts";

// ---------- Оценка ----------

export type AttemptBucket = "strong" | "mixed" | "weak";

export interface AttemptEvaluation {
  total: number;
  correct: number;
  incorrect: number;
  /** null — в плане нет упражнений (чисто читательский урок). */
  scoreRatio: number | null;
  bucket: AttemptBucket | null;
  passed: boolean;
}

/** Порог зачёта: урок — половина (как «mixed» у проверки знаний), быстрая
 *  проверка — «strong», как и раньше (результат от 80% засчитывает урок). */
export function passThreshold(mode: LessonMode): number {
  return mode === "check" ? KNOWLEDGE_CHECK_STRONG_THRESHOLD : KNOWLEDGE_CHECK_MIXED_THRESHOLD;
}

export function evaluateAttempt(plan: LessonPlan, answers: readonly StoredAnswer[]): AttemptEvaluation {
  const total = plan.exerciseOrder.length;
  const planned = new Set(plan.exerciseOrder);
  const counted = new Set<string>();
  let correct = 0;
  for (const answer of answers) {
    if (!planned.has(answer.exerciseId) || counted.has(answer.exerciseId)) continue;
    counted.add(answer.exerciseId);
    if (answer.correct) correct++;
  }
  const incorrect = counted.size - correct;

  if (total === 0) return { total, correct, incorrect, scoreRatio: null, bucket: null, passed: true };

  const outcome = scoreKnowledgeCheck(correct, total);
  return {
    total,
    correct,
    incorrect,
    scoreRatio: outcome.scoreRatio,
    bucket: outcome.bucket,
    passed: outcome.scoreRatio >= passThreshold(plan.mode),
  };
}

// ---------- Прогресс навыка ----------

export interface SkillProgressPatchPlan {
  patch: Partial<
    Pick<
      SkillProgressRow,
      "status" | "evidence_count" | "confidence" | "content_completed_at" | "last_practiced_at" | "knowledge_check_best_score"
    >
  >;
  /** Урок засчитан именно этой попыткой (раньше не был пройден). */
  newlyCompleted: boolean;
}

/** Что записать в user_skill_progress по итогам попытки.
 *
 *  • уверенность (status/confidence) меняется только если в плане достаточно
 *    вопросов банка (masteryEligible) — по тем же правилам, что и раньше у
 *    проверки знаний (applyKnowledgeCheckResult);
 *  • слабый результат никогда не понижает уже достигнутый статус;
 *  • «пройден» (content_completed_at) ставится при зачёте попытки и не
 *    затирается при повторном прохождении. */
export function planProgressUpdate(
  row: SkillProgressRow,
  input: { evaluation: AttemptEvaluation; masteryEligible: boolean; now: string },
): SkillProgressPatchPlan {
  const { evaluation, masteryEligible, now } = input;
  const alreadyCompleted = Boolean(row.content_completed_at);
  let patch: SkillProgressPatchPlan["patch"] = {};

  if (masteryEligible && evaluation.scoreRatio !== null) {
    const outcome: KnowledgeCheckOutcome = {
      scoreRatio: evaluation.scoreRatio,
      bucket: evaluation.bucket ?? "weak",
    };
    patch = applyKnowledgeCheckResult(row, outcome, now);
    if (outcome.bucket === "weak" && row.status !== "not_started") delete patch.status;
  } else if (evaluation.total > 0) {
    patch.last_practiced_at = now;
  }

  if (evaluation.passed) {
    // Считается от строки С УЖЕ применённым патчем проверки знаний:
    // applyLessonCompletion двигает только not_started → introduced и потому не
    // перебивает статус, который выставила проверка.
    patch = { ...patch, ...applyLessonCompletion({ ...row, ...patch } as SkillProgressRow, now) };
  }

  // Дата прохождения не перезаписывается при повторном прохождении.
  if (alreadyCompleted) delete patch.content_completed_at;
  return { patch, newlyCompleted: evaluation.passed && !alreadyCompleted };
}
