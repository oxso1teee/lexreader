import { findSkill, getPath, isValidSkillForPath } from "../learning-paths/curriculum/index.ts";
import { buildPathMap, isLessonOpen } from "../learning-paths/path-map.ts";
import { scoreKnowledgeCheck } from "../learning-paths/progress-engine.ts";
import type { LearningPath, Skill } from "../learning-paths/types.ts";
import type { Moment } from "../moments/types.ts";
import {
  advanceContent,
  answeredResults,
  countAnswers,
  isReadyToFinish,
  sanitizeStoredAnswers,
  submitExercise,
  type AttemptState,
  type TransitionError,
} from "./attempt-state.ts";
import type { LessonCompletionDto, LessonSessionDto, StepProgressDto, SubmitAnswerDto } from "./dto.ts";
import { failure, success, type ActionResult, type LessonErrorCode } from "./errors.ts";
import { buildLessonPlan, toPublicSteps } from "./plan.ts";
import type { ServiceDeps } from "./ports.ts";
import { evaluateAttempt, lessonXp, planProgressUpdate, type AttemptEvaluation } from "./scoring.ts";
import type { AttemptRecord, LessonMode, LessonPlan, SkillAddress } from "./types.ts";

// Сценарии урока: начать/продолжить → пройти шаг → ответить → завершить.
// Вся логика зависит от портов (ports.ts) и поэтому проверяется без БД.
//
// Правила, которые держит этот слой:
//   • пользователь — только из deps.userId (серверная сессия), не из запроса;
//   • навык и порядок шагов — из курса и плана, клиент присылает лишь id;
//   • ответ проверяется здесь, правильные ответы клиенту до ответа не уходят;
//   • любой повтор (двойной клик, вторая вкладка, обновление) безопасен;
//   • награда начисляется не более одного раза на навык.

const TRANSITION_TO_CODE: Record<TransitionError, LessonErrorCode> = {
  unknown_step: "out_of_sequence",
  out_of_sequence: "out_of_sequence",
  empty_response: "empty_response",
  invalid_response: "invalid_response",
};

interface LoadedAttempt {
  attempt: AttemptRecord;
  path: LearningPath;
  skill: Skill;
  plan: LessonPlan;
}

async function loadAttempt(deps: ServiceDeps, attemptId: string): Promise<ActionResult<LoadedAttempt>> {
  if (typeof attemptId !== "string" || attemptId.length === 0) return failure("not_found");
  let attempt: AttemptRecord | null;
  try {
    attempt = await deps.store.findById(attemptId);
  } catch {
    return failure("storage_failed");
  }
  if (!attempt) return failure("not_found");
  const path = getPath(attempt.pathSlug);
  const skill = path ? findSkill(path, attempt.skillKey) : null;
  if (!path || !skill) return failure("not_found");
  const plan = buildLessonPlan(skill, attempt.mode);
  if (!plan) return failure("no_exercises");
  return success({ attempt, path, skill, plan });
}

function stateOf(plan: LessonPlan, attempt: AttemptRecord): AttemptState {
  return { stepIndex: attempt.stepIndex, answers: sanitizeStoredAnswers(plan, attempt.answers) };
}

function progressDto(plan: LessonPlan, state: AttemptState): StepProgressDto {
  const { correct, incorrect } = countAnswers(state.answers);
  return { stepIndex: state.stepIndex, stepsTotal: plan.steps.length, correctCount: correct, incorrectCount: incorrect };
}

function sessionDto(plan: LessonPlan, attempt: AttemptRecord, resumed: boolean): LessonSessionDto {
  const state = stateOf(plan, attempt);
  return {
    ...progressDto(plan, state),
    attemptId: attempt.id,
    mode: attempt.mode,
    resumed,
    steps: toPublicSteps(plan),
    answered: answeredResults(plan, state.answers),
  };
}

// ---------- start / resume ----------

export async function startSession(deps: ServiceDeps, address: SkillAddress, mode: LessonMode): Promise<ActionResult<LessonSessionDto>> {
  if (mode !== "lesson" && mode !== "check") return failure("not_found");
  if (!isValidSkillForPath(address.pathSlug, address.skillKey)) return failure("not_found");
  const path = getPath(address.pathSlug);
  const skill = path ? findSkill(path, address.skillKey) : null;
  if (!path || !skill || path.version !== address.pathVersion) return failure("not_found");

  const plan = buildLessonPlan(skill, mode);
  if (!plan) return failure("no_exercises");

  try {
    // Замок проверяется на сервере, а не только в интерфейсе. Быстрая проверка
    // доступна и на закрытом уроке — это обходной путь для знакомой темы.
    if (mode === "lesson") {
      const rows = await deps.progressFor(address).loadPathRows();
      if (!isLessonOpen(buildPathMap(path, rows), skill.key)) return failure("locked");
    }

    const open = await deps.store.findOpen(address, mode);
    if (open && open.signature === plan.signature && open.stepsTotal === plan.steps.length) {
      return success(sessionDto(plan, open, true));
    }
    // Курс изменился, пока попытка лежала открытой, — её позиция больше не
    // соответствует плану. Закрываем старую и начинаем новую.
    if (open) await deps.store.abandon(open.id);

    const created = await deps.store.create({ ...address, mode, stepsTotal: plan.steps.length, signature: plan.signature });
    return success(sessionDto(plan, created, created.stepIndex > 0));
  } catch {
    return failure("storage_failed");
  }
}

// ---------- шаг с содержимым ----------

export async function advanceStep(deps: ServiceDeps, attemptId: string, stepId: string): Promise<ActionResult<StepProgressDto>> {
  const loaded = await loadAttempt(deps, attemptId);
  if (!loaded.ok) return loaded;
  const { attempt, plan } = loaded.data;
  if (attempt.status === "abandoned") return failure("conflict");
  const state = stateOf(plan, attempt);
  if (attempt.status === "completed") return success(progressDto(plan, state));
  if (attempt.signature !== plan.signature) return failure("stale_plan");

  const transition = advanceContent(plan, state, typeof stepId === "string" ? stepId : "");
  if (!transition.ok) return failure(TRANSITION_TO_CODE[transition.error]);
  if (transition.replay) return success(progressDto(plan, state));

  try {
    const counts = countAnswers(transition.state.answers);
    const saved = await deps.store.saveProgress(attempt.id, attempt.stepIndex, {
      stepIndex: transition.state.stepIndex,
      answers: transition.state.answers,
      correctCount: counts.correct,
      incorrectCount: counts.incorrect,
    });
    if (saved) return success(progressDto(plan, stateOf(plan, saved)));

    // Проиграли гонку: тот же шаг уже принят другим запросом — это не ошибка.
    const fresh = await deps.store.findById(attempt.id);
    if (fresh && fresh.stepIndex > attempt.stepIndex) return success(progressDto(plan, stateOf(plan, fresh)));
    return failure("conflict");
  } catch {
    return failure("storage_failed");
  }
}

// ---------- ответ на упражнение ----------

export async function submitAnswer(
  deps: ServiceDeps,
  attemptId: string,
  exerciseId: string,
  rawResponse: unknown,
): Promise<ActionResult<SubmitAnswerDto>> {
  const loaded = await loadAttempt(deps, attemptId);
  if (!loaded.ok) return loaded;
  const { attempt, plan } = loaded.data;
  if (attempt.status === "abandoned") return failure("conflict");
  // У завершённой попытки все упражнения уже отвечены: любой запрос — повтор и
  // вернёт сохранённый результат. Устаревший план мешает только открытой.
  if (attempt.status === "in_progress" && attempt.signature !== plan.signature) return failure("stale_plan");

  const state = stateOf(plan, attempt);
  const transition = submitExercise(plan, state, typeof exerciseId === "string" ? exerciseId : "", rawResponse, deps.now());
  if (!transition.ok) return failure(TRANSITION_TO_CODE[transition.error]);

  const result = { response: transition.response, verdict: transition.verdict };
  if (transition.replay) {
    return success({ result, progress: progressDto(plan, state), replayed: true });
  }

  try {
    const counts = countAnswers(transition.state.answers);
    const saved = await deps.store.saveProgress(attempt.id, attempt.stepIndex, {
      stepIndex: transition.state.stepIndex,
      answers: transition.state.answers,
      correctCount: counts.correct,
      incorrectCount: counts.incorrect,
    });
    if (saved) return success({ result, progress: progressDto(plan, stateOf(plan, saved)), replayed: false });

    // Гонка: тот же ответ принят параллельным запросом. Возвращаем принятый
    // результат (а не наш), чтобы клиент видел то, что реально сохранено.
    const fresh = await deps.store.findById(attempt.id);
    if (!fresh) return failure("not_found");
    const freshState = stateOf(plan, fresh);
    const stored = answeredResults(plan, freshState.answers)[exerciseId];
    if (stored) return success({ result: stored, progress: progressDto(plan, freshState), replayed: true });
    return failure("conflict");
  } catch {
    return failure("storage_failed");
  }
}

// ---------- завершение ----------

// Результат завершённой попытки берётся из сохранённых полей, а не пересчитывается
// по текущему плану: курс мог измениться после прохождения.
function evaluationFromAttempt(attempt: AttemptRecord): AttemptEvaluation {
  const total = attempt.correctCount + attempt.incorrectCount;
  return {
    total,
    correct: attempt.correctCount,
    incorrect: attempt.incorrectCount,
    scoreRatio: total > 0 ? attempt.scoreRatio : null,
    bucket: total > 0 ? scoreKnowledgeCheck(attempt.correctCount, total).bucket : null,
    passed: attempt.passed === true,
  };
}

/** Завершает попытку. Вызов идемпотентен: повтор (обновление страницы, второй
 *  клик, повторное открытие экрана результата) не меняет данные и не
 *  начисляет XP второй раз. Побочные эффекты (прогресс навыка, XP) применяются
 *  с самовосстановлением: если процесс упал после фиксации результата, но до
 *  применения эффектов, следующий вызов доделает их — каждый шаг идемпотентен. */
export async function finishSession(deps: ServiceDeps, attemptId: string): Promise<ActionResult<LessonCompletionDto>> {
  const loaded = await loadAttempt(deps, attemptId);
  if (!loaded.ok) return loaded;
  const { path, skill, plan } = loaded.data;
  let attempt = loaded.data.attempt;
  const address: SkillAddress = { pathSlug: attempt.pathSlug, pathVersion: attempt.pathVersion, skillKey: attempt.skillKey };

  try {
    if (attempt.status === "abandoned") return failure("conflict");

    if (attempt.status === "in_progress") {
      if (attempt.signature !== plan.signature) return failure("stale_plan");
      const state = stateOf(plan, attempt);
      if (!isReadyToFinish(plan, state)) return failure("not_ready");

      const result = evaluateAttempt(plan, state.answers);
      const completed = await deps.store.markCompleted(attempt.id, {
        passed: result.passed,
        scoreRatio: result.scoreRatio,
        correctCount: result.correct,
        incorrectCount: result.incorrect,
      });
      if (completed) {
        attempt = completed;
      } else {
        // Параллельный запрос завершил попытку раньше — продолжаем с её результатом.
        const fresh = await deps.store.findById(attempt.id);
        if (!fresh || fresh.status !== "completed") return failure("conflict");
        attempt = fresh;
      }
    }

    const evaluation = evaluationFromAttempt(attempt);
    const progress = deps.progressFor(address);
    let xpAwarded = attempt.xpAwarded;
    let firstWin = false;
    let xpPending = false;
    let moments: Moment[] = [];
    const finalizedNow = attempt.finalizedAt === null;

    if (finalizedNow) {
      const row = await progress.load();
      const { patch, newlyCompleted } = planProgressUpdate(row, {
        evaluation,
        masteryEligible: plan.masteryEligible,
        now: deps.now(),
      });
      if (Object.keys(patch).length > 0) await progress.save(row, patch);
      const unitDone = await progress.afterChange(newlyCompleted);
      if (unitDone) moments.push(unitDone);

      if (evaluation.passed && attempt.xpClaimedAt === null) {
        const amount = lessonXp(evaluation.correct, evaluation.total);
        if (await deps.store.claimXp(attempt.id, amount)) {
          // Право занимается ДО начисления: два параллельных завершения не удвоят
          // награду. Если начислить не вышло (grantXp вернул null — по контракту это
          // «ничего не записано»), право освобождается, и повторное завершение
          // попробует снова. Сбой процесса прямо между claim и addXp оставляет
          // право занятым без XP — осознанный выбор «лучше потерять, чем удвоить»
          // (тот же приём, что у наград дуэлей: флаг в БД + addXp на TS-стороне).
          const grant = await deps.rewards.grantXp(amount);
          if (grant) {
            xpAwarded = grant.awarded;
            moments = [...moments, ...grant.moments];
            await deps.store.setXpAwarded(attempt.id, xpAwarded);
          } else {
            await deps.store.releaseXpClaim(attempt.id);
            xpAwarded = 0;
            xpPending = true;
          }
        }
      }

      // Первая «победа» онбординга — любое настоящее завершённое задание
      // (как и раньше у проверки знаний), а не только зачтённое. Ошибка записи
      // пробрасывается: иначе завершение пометилось бы доведённым до конца, а
      // пользователь остался бы запертым в онбординге без повтора.
      if (evaluation.total > 0) firstWin = await deps.rewards.markFirstWin();

      // Пока XP ждёт повтора, попытка остаётся «не доведённой до конца» — следующее
      // завершение (кнопка «Повторить начисление» или обновление) снова пройдёт эти шаги.
      if (!xpPending) await deps.store.markFinalized(attempt.id);
    }

    const alreadyEarned = xpPending ? false : xpAwarded > 0 || (await deps.store.hasXpClaim(address));
    const map = buildPathMap(path, await progress.loadPathRows());
    const lesson = map.units.flatMap((unit) => unit.lessons).find((node) => node.key === skill.key);
    const unit = map.units.find((u) => u.lessons.some((node) => node.key === skill.key));
    const next = map.next && map.next.lesson.key !== skill.key ? map.next : null;

    return success({
      attemptId: attempt.id,
      pathSlug: attempt.pathSlug,
      skillKey: attempt.skillKey,
      finalizedNow,
      mode: attempt.mode,
      passed: evaluation.passed,
      scoreRatio: evaluation.scoreRatio,
      bucket: evaluation.bucket,
      correctCount: evaluation.correct,
      incorrectCount: evaluation.incorrect,
      xpAwarded,
      xpAlreadyEarned: alreadyEarned,
      xpPending,
      lessonCompleted: lesson?.state === "done",
      firstWin,
      moments,
      path: {
        percent: map.percent,
        doneLessons: map.doneLessons,
        totalLessons: map.totalLessons,
        complete: map.complete,
        unitTitle: unit?.title ?? "",
        unitDone: unit?.state === "done",
      },
      nextLesson: next ? { skillKey: next.lesson.key, unitKey: next.unit.key, title: next.lesson.skill.title } : null,
    });
  } catch {
    return failure("storage_failed");
  }
}
