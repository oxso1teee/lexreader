import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULA, findSkill, getAllSkills } from "../learning-paths/curriculum/index.ts";
import { emptySkillProgress } from "../learning-paths/progress-engine.ts";
import type { SkillProgressRow } from "../learning-paths/types.ts";
import type { UnitDoneMoment } from "../moments/types.ts";
import { LESSON_BASE_XP, LESSON_PERFECT_BONUS_XP } from "./scoring.ts";
import { advanceStep, finishSession, startSession, submitAnswer } from "./service.ts";
import { buildLessonPlan } from "./plan.ts";
import { createHarness, MemoryAttemptStore, type Harness } from "./testing/memory.ts";
import type { ExerciseResponse, LessonMode, LessonPlan, ServerExercise, SkillAddress } from "./types.ts";

const path = CURRICULA["a2-b1"];
const SKILL = "grammar.present_simple";
const address: SkillAddress = { pathSlug: "a2-b1", pathVersion: 1, skillKey: SKILL };
const skill = findSkill(path, SKILL)!;
const lessonPlan = buildLessonPlan(skill, "lesson")!;
const checkPlan = buildLessonPlan(skill, "check")!;

function right(exercise: ServerExercise): ExerciseResponse {
  return exercise.type === "sentence_build" ? { type: "tiles", tiles: exercise.solution } : { type: "choice", index: exercise.correctIndex };
}

function wrong(exercise: ServerExercise): ExerciseResponse {
  if (exercise.type === "sentence_build") return { type: "tiles", tiles: [...exercise.solution].reverse() };
  return { type: "choice", index: (exercise.correctIndex + 1) % exercise.options.length };
}

function progressRow(skillKey: string, overrides: Partial<SkillProgressRow> = {}): SkillProgressRow {
  return {
    id: `row-${skillKey}`,
    created_at: "t",
    updated_at: "t",
    ...emptySkillProgress("user-1", path, skillKey),
    ...overrides,
  };
}

/** Уроки до `skillKey` пройдены — значит, `skillKey` открыт. */
function rowsDoneBefore(skillKey: string): SkillProgressRow[] {
  const skills = getAllSkills(path);
  const index = skills.findIndex((s) => s.key === skillKey);
  return skills.slice(0, index).map((s) => progressRow(s.key, { status: "introduced", content_completed_at: "2025-01-01T00:00:00.000Z" }));
}

async function begin(h: Harness, mode: LessonMode = "lesson") {
  const started = await startSession(h.deps, h.progress.address, mode);
  assert.ok(started.ok, started.ok ? "" : started.code);
  return started.data;
}

/** Проходит весь план; answerFor решает, как отвечать на каждое упражнение. */
async function playThrough(h: Harness, plan: LessonPlan, mode: LessonMode, answerFor: (exercise: ServerExercise, index: number) => ExerciseResponse) {
  const session = await begin(h, mode);
  let exerciseIndex = 0;
  for (const step of plan.steps) {
    if (step.kind === "content") {
      const r = await advanceStep(h.deps, session.attemptId, step.id);
      assert.ok(r.ok, r.ok ? "" : r.code);
    } else {
      const exercise = plan.exercises[step.exerciseId];
      const r = await submitAnswer(h.deps, session.attemptId, exercise.id, answerFor(exercise, exerciseIndex++));
      assert.ok(r.ok, r.ok ? "" : r.code);
    }
  }
  return session;
}

// ---------- старт / восстановление ----------

test("start: создаёт попытку; клиент получает шаги без правильных ответов", async () => {
  const h = createHarness(address);
  const session = await begin(h);
  assert.equal(session.mode, "lesson");
  assert.equal(session.stepIndex, 0);
  assert.equal(session.steps.length, lessonPlan.steps.length);
  assert.equal(session.resumed, false);
  assert.deepEqual(session.answered, {});
  assert.ok(!/correctIndex|solution|explanation|correctAnswer/.test(JSON.stringify(session)));
  assert.equal(h.store.rows.length, 1);
});

test("start: повторный вызов (обновление страницы, вторая вкладка) продолжает ту же попытку", async () => {
  const h = createHarness(address);
  const first = await begin(h);
  await advanceStep(h.deps, first.attemptId, "content:intro");
  await advanceStep(h.deps, first.attemptId, "content:material");

  const again = await begin(h);
  assert.equal(again.attemptId, first.attemptId);
  assert.equal(again.stepIndex, 2, "позиция восстановлена");
  assert.equal(again.resumed, true);
  assert.equal(h.store.rows.length, 1, "новая попытка не создаётся");
});

test("start: восстановление возвращает результаты уже отвеченных упражнений (и только их)", async () => {
  const h = createHarness(address);
  const session = await begin(h);
  for (const step of lessonPlan.steps.slice(0, 3)) await advanceStep(h.deps, session.attemptId, step.id);
  const [e1, e2] = lessonPlan.exerciseOrder;
  await submitAnswer(h.deps, session.attemptId, e1, wrong(lessonPlan.exercises[e1]));

  const resumed = await begin(h);
  assert.deepEqual(Object.keys(resumed.answered), [e1]);
  assert.equal(resumed.answered[e1].verdict.correct, false);
  assert.equal(resumed.answered[e2], undefined);
  assert.equal(resumed.correctCount, 0);
  assert.equal(resumed.incorrectCount, 1);
});

test("start: закрытый урок недоступен, быстрая проверка на закрытом уроке — доступна", async () => {
  const locked: SkillAddress = { ...address, skillKey: "grammar.past_simple" };
  const h = createHarness(locked, { rows: [] });
  const denied = await startSession(h.deps, locked, "lesson");
  assert.deepEqual(denied.ok ? null : denied.code, "locked");
  assert.equal(h.store.rows.length, 0, "попытка не создана");

  const check = await startSession(h.deps, locked, "check");
  assert.ok(check.ok, "обходной путь для знакомой темы остаётся");
});

test("start: урок открыт, когда пройден предыдущий", async () => {
  const unlocked: SkillAddress = { ...address, skillKey: "grammar.present_continuous" };
  const h = createHarness(unlocked, { rows: rowsDoneBefore("grammar.present_continuous") });
  assert.ok((await startSession(h.deps, unlocked, "lesson")).ok);
});

test("start: неизвестный навык/путь/режим и проверка без вопросов → понятные коды", async () => {
  const h = createHarness(address);
  const code = async (a: SkillAddress, mode: LessonMode) => {
    const r = await startSession(h.deps, a, mode);
    return r.ok ? "ok" : r.code;
  };
  assert.equal(await code({ ...address, skillKey: "grammar.nope" }, "lesson"), "not_found");
  assert.equal(await code({ ...address, pathSlug: "nope" as never }, "lesson"), "not_found");
  assert.equal(await code({ ...address, pathVersion: 7 }, "lesson"), "not_found");
  for (const slug of ["constructor", "__proto__", "toString"]) {
    assert.equal(await code({ ...address, pathSlug: slug as never }, "lesson"), "not_found", slug);
  }
  assert.equal(await code(address, "hacked" as never), "not_found");
  const topic: SkillAddress = { pathSlug: "everyday", pathVersion: 1, skillKey: "topic.greetings_introductions" };
  assert.equal(await code(topic, "check"), "no_exercises");
});

test("start: ошибка хранилища → storage_failed, а не исключение", async () => {
  const h = createHarness(address);
  h.store.failNext("findOpen");
  const r = await startSession(h.deps, address, "lesson");
  assert.deepEqual(r.ok ? null : r.code, "storage_failed");
  assert.ok((await startSession(h.deps, address, "lesson")).ok, "повтор после сбоя проходит");
});

test("start: открытая попытка со старым отпечатком плана закрывается, начинается новая", async () => {
  const h = createHarness(address);
  const first = await begin(h);
  h.store.rows[0].signature = "old-plan";
  const second = await begin(h);
  assert.notEqual(second.attemptId, first.attemptId);
  assert.equal(second.stepIndex, 0);
  assert.equal(h.store.rows.find((r) => r.id === first.attemptId)!.status, "abandoned");
});

// ---------- шаги ----------

test("advance: шаг фиксируется в БД сразу; двойной клик не пишет второй раз", async () => {
  const h = createHarness(address);
  const session = await begin(h);
  const [a, b] = await Promise.all([
    advanceStep(h.deps, session.attemptId, "content:intro"),
    advanceStep(h.deps, session.attemptId, "content:intro"),
  ]);
  assert.ok(a.ok && b.ok);
  assert.equal(h.store.rows[0].stepIndex, 1);
  const third = await advanceStep(h.deps, session.attemptId, "content:intro");
  assert.ok(third.ok);
  assert.equal(third.data.stepIndex, 1);
});

test("advance: некорректная последовательность и чужие шаги отклоняются", async () => {
  const h = createHarness(address);
  const session = await begin(h);
  const ahead = await advanceStep(h.deps, session.attemptId, "content:mistakes");
  assert.deepEqual(ahead.ok ? null : ahead.code, "out_of_sequence");
  const bogus = await advanceStep(h.deps, session.attemptId, "content:nope");
  assert.deepEqual(bogus.ok ? null : bogus.code, "out_of_sequence");
  const exercise = await advanceStep(h.deps, session.attemptId, `ex:${lessonPlan.exerciseOrder[0]}`);
  assert.equal(exercise.ok, false, "упражнение нельзя «пролистать»");
  assert.equal(h.store.rows[0].stepIndex, 0);
});

test("advance: ошибка записи → storage_failed, позиция не меняется", async () => {
  const h = createHarness(address);
  const session = await begin(h);
  h.store.failNext("saveProgress");
  const r = await advanceStep(h.deps, session.attemptId, "content:intro");
  assert.deepEqual(r.ok ? null : r.code, "storage_failed");
  assert.equal(h.store.rows[0].stepIndex, 0);
  assert.ok((await advanceStep(h.deps, session.attemptId, "content:intro")).ok);
});

// ---------- ответы ----------

async function atFirstExercise(h: Harness) {
  const session = await begin(h);
  for (const step of lessonPlan.steps) {
    if (step.kind !== "content") break;
    await advanceStep(h.deps, session.attemptId, step.id);
  }
  return session;
}

test("submit: ответ проверяется на сервере, правильный ответ раскрывается только после ответа", async () => {
  const h = createHarness(address);
  const session = await atFirstExercise(h);
  const id = lessonPlan.exerciseOrder[0];
  const exercise = lessonPlan.exercises[id];

  const r = await submitAnswer(h.deps, session.attemptId, id, wrong(exercise));
  assert.ok(r.ok);
  assert.equal(r.data.result.verdict.correct, false);
  assert.equal(r.data.result.verdict.correctAnswer, exercise.type === "sentence_build" ? exercise.solution.join(" ") : exercise.options[exercise.correctIndex]);
  assert.ok(r.data.result.verdict.explanation.length > 0);
  assert.equal(r.data.progress.incorrectCount, 1);
  assert.equal(h.store.rows[0].answers.length, 1, "ответ сохранён");
  assert.equal(h.store.rows[0].incorrectCount, 1);
});

test("submit: повторная отправка того же ответа не удваивает счёт; смена ответа не принимается", async () => {
  const h = createHarness(address);
  const session = await atFirstExercise(h);
  const id = lessonPlan.exerciseOrder[0];
  const exercise = lessonPlan.exercises[id];

  const first = await submitAnswer(h.deps, session.attemptId, id, wrong(exercise));
  const dup = await submitAnswer(h.deps, session.attemptId, id, wrong(exercise));
  const changed = await submitAnswer(h.deps, session.attemptId, id, right(exercise));
  assert.ok(first.ok && dup.ok && changed.ok);
  assert.equal(first.data.replayed, false);
  assert.equal(dup.data.replayed, true);
  assert.equal(changed.data.replayed, true);
  assert.equal(changed.data.result.verdict.correct, false, "засчитан первый ответ");
  assert.equal(h.store.rows[0].answers.length, 1);
  assert.equal(h.store.rows[0].incorrectCount, 1);
  assert.equal(h.store.rows[0].correctCount, 0);
});

test("submit: две параллельные отправки — принимается одна, вторая видит принятый результат", async () => {
  const h = createHarness(address);
  const session = await atFirstExercise(h);
  const id = lessonPlan.exerciseOrder[0];
  const exercise = lessonPlan.exercises[id];

  const results = await Promise.all([
    submitAnswer(h.deps, session.attemptId, id, right(exercise)),
    submitAnswer(h.deps, session.attemptId, id, right(exercise)),
    submitAnswer(h.deps, session.attemptId, id, wrong(exercise)),
  ]);
  assert.ok(results.every((r) => r.ok));
  assert.equal(h.store.rows[0].answers.length, 1, "в БД ровно один ответ");
  assert.equal(h.store.rows[0].stepIndex, 4);
  const verdicts = new Set(results.map((r) => (r.ok ? r.data.result.verdict.correct : null)));
  assert.equal(verdicts.size, 1, "все получили один и тот же принятый результат");
});

test("submit: пустой и некорректный ответ → ошибка, ничего не сохраняется, шаг можно повторить", async () => {
  const h = createHarness(address);
  const session = await atFirstExercise(h);
  const id = lessonPlan.exerciseOrder[0];
  const empty = await submitAnswer(h.deps, session.attemptId, id, undefined);
  const garbage = await submitAnswer(h.deps, session.attemptId, id, { type: "choice", index: 1000 });
  assert.deepEqual(empty.ok ? null : empty.code, "empty_response");
  assert.deepEqual(garbage.ok ? null : garbage.code, "invalid_response");
  assert.equal(h.store.rows[0].answers.length, 0);
  assert.ok((await submitAnswer(h.deps, session.attemptId, id, right(lessonPlan.exercises[id]))).ok);
});

test("submit: ответ вне очереди и на материал отклоняется", async () => {
  const h = createHarness(address);
  const session = await begin(h);
  const id = lessonPlan.exerciseOrder[0];
  const early = await submitAnswer(h.deps, session.attemptId, id, right(lessonPlan.exercises[id]));
  assert.deepEqual(early.ok ? null : early.code, "out_of_sequence");
  const late = lessonPlan.exerciseOrder[3];
  await atFirstExercise(h);
  const skipped = await submitAnswer(h.deps, session.attemptId, late, right(lessonPlan.exercises[late]));
  assert.deepEqual(skipped.ok ? null : skipped.code, "out_of_sequence");
});

test("submit: ошибка записи → storage_failed, ответ не засчитан", async () => {
  const h = createHarness(address);
  const session = await atFirstExercise(h);
  const id = lessonPlan.exerciseOrder[0];
  h.store.failNext("saveProgress");
  const r = await submitAnswer(h.deps, session.attemptId, id, right(lessonPlan.exercises[id]));
  assert.deepEqual(r.ok ? null : r.code, "storage_failed");
  assert.equal(h.store.rows[0].answers.length, 0);
});

// ---------- изоляция пользователей ----------

test("чужую попытку нельзя ни продолжить, ни ответить, ни завершить — для другого пользователя её «нет»", async () => {
  const owner = createHarness(address, { userId: "alice" });
  const session = await atFirstExercise(owner);
  const id = lessonPlan.exerciseOrder[0];

  const intruder = createHarness(address, { userId: "mallory", shared: owner.store.rows });
  const advance = await advanceStep(intruder.deps, session.attemptId, "content:intro");
  const submit = await submitAnswer(intruder.deps, session.attemptId, id, right(lessonPlan.exercises[id]));
  const finish = await finishSession(intruder.deps, session.attemptId);
  for (const r of [advance, submit, finish]) assert.deepEqual(r.ok ? null : r.code, "not_found");
  assert.equal(owner.store.rows[0].answers.length, 0, "чужие данные не тронуты");

  // и собственная попытка Mallory — отдельная, а не Alice.
  const own = await startSession(intruder.deps, address, "lesson");
  assert.ok(own.ok);
  assert.notEqual(own.data.attemptId, session.attemptId);
});

test("пустой/нестроковый attemptId не падает с исключением", async () => {
  const h = createHarness(address);
  for (const id of ["", undefined as never, null as never, 42 as never]) {
    const r = await advanceStep(h.deps, id, "content:intro");
    assert.deepEqual(r.ok ? null : r.code, "not_found");
  }
});

// ---------- завершение ----------

test("finish: нельзя завершить, пока остались шаги", async () => {
  const h = createHarness(address);
  const session = await atFirstExercise(h);
  const r = await finishSession(h.deps, session.attemptId);
  assert.deepEqual(r.ok ? null : r.code, "not_ready");
  assert.equal(h.store.rows[0].status, "in_progress");
  assert.equal(h.rewards.xpGrants.length, 0);
});

test("finish: идеальное прохождение — урок засчитан, прогресс записан, XP начислен один раз", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  const done = await finishSession(h.deps, session.attemptId);
  assert.ok(done.ok);
  const dto = done.data;
  assert.equal(dto.passed, true);
  assert.equal(dto.lessonCompleted, true);
  assert.equal(dto.correctCount, lessonPlan.exerciseOrder.length);
  assert.equal(dto.incorrectCount, 0);
  assert.equal(dto.xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
  assert.deepEqual(h.rewards.xpGrants, [LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP]);
  assert.equal(dto.path.doneLessons, 1);
  assert.equal(dto.nextLesson?.skillKey, "grammar.present_continuous", "следующий урок — по правилам Learning Path");

  const saved = h.rows.find((r) => r.skill_key === SKILL)!;
  assert.ok(saved.content_completed_at);
  assert.equal(saved.status, "confident");
  assert.equal(h.store.rows[0].status, "completed");
  assert.ok(h.store.rows[0].finalizedAt);
  assert.equal(h.store.rows[0].xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
  assert.ok(h.rewards.firstWinSet && dto.firstWin);
});

test("finish: повторные вызовы (обновление, второй клик, повторное открытие экрана) не начисляют XP и не меняют данные", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  const first = await finishSession(h.deps, session.attemptId);
  const savesAfterFirst = h.progress.saves;
  const second = await finishSession(h.deps, session.attemptId);
  const third = await finishSession(h.deps, session.attemptId);
  assert.ok(first.ok && second.ok && third.ok);

  assert.equal(h.rewards.xpGrants.length, 1, "XP начислен ровно один раз");
  assert.equal(h.progress.saves, savesAfterFirst, "прогресс не перезаписывается");
  assert.equal(h.progress.afterChangeCalls.length, 1);
  assert.equal(second.data.xpAwarded, first.data.xpAwarded, "экран показывает тот же результат");
  assert.equal(second.data.correctCount, first.data.correctCount);
  assert.deepEqual(second.data.moments, [], "моменты показываются один раз");
  assert.equal(second.data.firstWin, false);
  assert.equal(second.data.lessonCompleted, true);
});

test("finish: finalizedNow — true только у вызова, применившего итоги (по нему шлются события и моменты)", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  const first = await finishSession(h.deps, session.attemptId);
  const second = await finishSession(h.deps, session.attemptId);
  assert.ok(first.ok && second.ok);
  assert.equal(first.data.finalizedNow, true);
  assert.equal(second.data.finalizedNow, false);
  assert.equal(first.data.pathSlug, "a2-b1");
  assert.equal(first.data.skillKey, SKILL);
});

test("finish: параллельные завершения (две вкладки) дают один XP", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  const results = await Promise.all([finishSession(h.deps, session.attemptId), finishSession(h.deps, session.attemptId), finishSession(h.deps, session.attemptId)]);
  assert.ok(results.every((r) => r.ok));
  assert.equal(h.rewards.xpGrants.length, 1);
  assert.equal(h.store.rows.filter((r) => r.xpClaimedAt !== null).length, 1);
});

test("finish: XP начисляется один раз на НАВЫК — повторное прохождение это практика без награды", async () => {
  const h = createHarness(address);
  const first = await playThrough(h, lessonPlan, "lesson", right);
  const firstDone = await finishSession(h.deps, first.attemptId);
  assert.ok(firstDone.ok);

  const replay = await playThrough(h, lessonPlan, "lesson", right); // новая попытка того же урока
  assert.notEqual(replay.attemptId, first.attemptId);
  const replayDone = await finishSession(h.deps, replay.attemptId);
  assert.ok(replayDone.ok);
  assert.equal(replayDone.data.xpAwarded, 0);
  assert.equal(replayDone.data.xpAlreadyEarned, true);
  assert.equal(h.rewards.xpGrants.length, 1);
  assert.equal(h.store.rows.filter((r) => r.xpClaimedAt !== null).length, 1);
});

test("finish: провал (меньше порога) — урок не засчитан, XP нет, можно пройти заново и получить XP", async () => {
  const h = createHarness(address);
  const failed = await playThrough(h, lessonPlan, "lesson", wrong);
  const failedDone = await finishSession(h.deps, failed.attemptId);
  assert.ok(failedDone.ok);
  assert.equal(failedDone.data.passed, false);
  assert.equal(failedDone.data.lessonCompleted, false);
  assert.equal(failedDone.data.xpAwarded, 0);
  assert.equal(failedDone.data.xpAlreadyEarned, false);
  assert.equal(h.rewards.xpGrants.length, 0);
  assert.equal(failedDone.data.nextLesson, null, "следующий урок не открыт");
  assert.equal(h.rows.find((r) => r.skill_key === SKILL)?.content_completed_at, null);
  assert.ok(h.rewards.firstWinSet, "настоящее выполненное задание закрывает «первую победу», как и раньше");

  const retry = await playThrough(h, lessonPlan, "lesson", right);
  assert.notEqual(retry.attemptId, failed.attemptId);
  const retryDone = await finishSession(h.deps, retry.attemptId);
  assert.ok(retryDone.ok);
  assert.equal(retryDone.data.lessonCompleted, true);
  assert.equal(retryDone.data.xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
});

test("finish: бонус за «без ошибок» не выдаётся при ошибках", async () => {
  const h = createHarness(address);
  const n = lessonPlan.exerciseOrder.length;
  const session = await playThrough(h, lessonPlan, "lesson", (exercise, index) => (index === n - 1 ? wrong(exercise) : right(exercise)));
  const done = await finishSession(h.deps, session.attemptId);
  assert.ok(done.ok);
  assert.equal(done.data.passed, true);
  assert.equal(done.data.xpAwarded, LESSON_BASE_XP);
  assert.equal(done.data.incorrectCount, 1);
});

test("finish: самовосстановление — сбой после фиксации результата не теряет и не дублирует эффекты", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);

  h.store.failNext("claimXp"); // падаем после markCompleted и записи прогресса, до XP
  const crashed = await finishSession(h.deps, session.attemptId);
  assert.deepEqual(crashed.ok ? null : crashed.code, "storage_failed");
  assert.equal(h.store.rows[0].status, "completed");
  assert.equal(h.store.rows[0].finalizedAt, null, "эффекты ещё не доведены до конца");
  assert.equal(h.rewards.xpGrants.length, 0);

  const recovered = await finishSession(h.deps, session.attemptId);
  assert.ok(recovered.ok);
  assert.equal(recovered.data.lessonCompleted, true);
  assert.equal(h.rewards.xpGrants.length, 1);
  assert.ok(h.store.rows[0].finalizedAt);

  await finishSession(h.deps, session.attemptId);
  assert.equal(h.rewards.xpGrants.length, 1, "после восстановления повторов нет");
});

test("finish: сбой начисления XP — урок засчитан, право на XP освобождено, экран честно говорит «ожидает», повтор начисляет ровно один раз", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);

  h.rewards.failNextGrant = true;
  const first = await finishSession(h.deps, session.attemptId);
  assert.ok(first.ok);
  assert.equal(first.data.lessonCompleted, true, "урок засчитан независимо от XP");
  assert.equal(first.data.xpAwarded, 0, "на экране только реально начисленное");
  assert.equal(first.data.xpPending, true);
  assert.equal(first.data.xpAlreadyEarned, false, "нельзя писать «уже получено», когда награда не дошла");
  assert.equal(h.rewards.xpGrants.length, 0);
  assert.equal(h.store.rows[0].xpClaimedAt, null, "право на XP освобождено — не сгорело");
  assert.equal(h.store.rows[0].finalizedAt, null, "попытка не считается доведённой до конца, пока XP ждёт повтора");

  const retry = await finishSession(h.deps, session.attemptId);
  assert.ok(retry.ok);
  assert.equal(retry.data.xpPending, false);
  assert.equal(retry.data.xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
  assert.equal(h.rewards.xpGrants.length, 1, "после повтора — ровно одно начисление");
  assert.ok(h.store.rows[0].finalizedAt);

  await finishSession(h.deps, session.attemptId);
  await finishSession(h.deps, session.attemptId);
  assert.equal(h.rewards.xpGrants.length, 1, "дальнейшие повторы XP не добавляют");
});

test("finish: сбой XP не блокирует прогресс и не ломается о повторные сбои — XP приходит, когда сбой прошёл", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  h.rewards.grantResult = "fail"; // сбой не одноразовый
  for (let i = 0; i < 3; i++) {
    const r = await finishSession(h.deps, session.attemptId);
    assert.ok(r.ok);
    assert.equal(r.data.xpPending, true);
    assert.equal(r.data.lessonCompleted, true);
  }
  assert.equal(h.rewards.xpGrants.length, 0);
  assert.equal(h.rows.filter((r) => r.content_completed_at).length >= 1, true, "прогресс по уроку сохранён");
  h.rewards.grantResult = null;
  const ok = await finishSession(h.deps, session.attemptId);
  assert.ok(ok.ok);
  assert.equal(ok.data.xpPending, false);
  assert.equal(h.rewards.xpGrants.length, 1);
});

test("finish: пока XP ждёт повтора, другая попытка того же навыка может занять право — но не удвоить", async () => {
  const h = createHarness(address);
  const first = await playThrough(h, lessonPlan, "lesson", right);
  h.rewards.failNextGrant = true;
  const pending = await finishSession(h.deps, first.attemptId);
  assert.ok(pending.ok && pending.data.xpPending);

  const second = await playThrough(h, lessonPlan, "lesson", right);
  const done = await finishSession(h.deps, second.attemptId);
  assert.ok(done.ok);
  assert.equal(done.data.xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
  // а вернувшись к первой попытке, XP повторно не получить: право уже у второй
  const late = await finishSession(h.deps, first.attemptId);
  assert.ok(late.ok);
  assert.equal(late.data.xpAwarded, 0);
  assert.equal(late.data.xpAlreadyEarned, true);
  assert.equal(h.rewards.xpGrants.length, 1);
  assert.equal(h.store.rows.filter((r) => r.xpClaimedAt !== null).length, 1);
});

test("finish: сбой записи флага первой победы пробрасывается как ошибка и не помечает завершение доведённым — повтор безопасен и не удваивает XP", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  h.rewards.failNextFirstWin = true;
  const failed = await finishSession(h.deps, session.attemptId);
  assert.deepEqual(failed.ok ? null : failed.code, "storage_failed");
  assert.equal(h.store.rows[0].finalizedAt, null);
  assert.equal(h.rewards.xpGrants.length, 1, "XP к этому моменту уже начислен");

  const retry = await finishSession(h.deps, session.attemptId);
  assert.ok(retry.ok);
  assert.equal(retry.data.firstWin, true, "флаг выставлен при повторе");
  assert.equal(h.rewards.xpGrants.length, 1, "повтор не начислил XP второй раз");
  assert.ok(h.store.rows[0].finalizedAt);
  assert.equal(retry.data.xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP, "экран показывает уже начисленное");
});

test("finish: сбой освобождения права не дублирует XP (ошибка, а не повторное начисление)", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  h.rewards.failNextGrant = true;
  h.store.failNext("releaseXpClaim");
  const failed = await finishSession(h.deps, session.attemptId);
  assert.deepEqual(failed.ok ? null : failed.code, "storage_failed");
  const retry = await finishSession(h.deps, session.attemptId);
  assert.ok(retry.ok);
  assert.equal(h.rewards.xpGrants.length, 0, "право осталось занятым — повторного начисления нет (лучше потерять, чем удвоить)");
});

test("finish: реально начисленный XP (например, ×2 по Double-XP) показывается и сохраняется", async () => {
  const h = createHarness(address);
  h.rewards.grantResult = { awarded: 40, moments: [{ kind: "goal_done", id: "goal_done:x", xpToday: 40, xpGoal: 30, minutesHint: 5, week: [] }] };
  const session = await playThrough(h, lessonPlan, "lesson", right);
  const done = await finishSession(h.deps, session.attemptId);
  assert.ok(done.ok);
  assert.equal(done.data.xpAwarded, 40);
  assert.equal(h.store.rows[0].xpAwarded, 40);
  assert.equal(done.data.moments[0]?.kind, "goal_done");
});

test("finish: раздел пройден — момент unit_done приходит один раз", async () => {
  const stage = path.stages[0];
  const stageSkills = stage.modules.flatMap((m) => m.skills);
  const last = stageSkills[stageSkills.length - 1];
  const lastAddress: SkillAddress = { ...address, skillKey: last.key };
  const h = createHarness(lastAddress, { rows: rowsDoneBefore(last.key) });
  const unitMoment: UnitDoneMoment = {
    kind: "unit_done",
    id: "unit-done-x",
    pathTitle: path.title,
    stageTitle: stage.title,
    stageIndex: 1,
    stagesTotal: path.stages.length,
    skillsInStage: stageSkills.length,
    nextStageTitle: null,
  };
  h.progress.unitDone = unitMoment;

  const plan = buildLessonPlan(last, "lesson")!;
  const session = await playThrough(h, plan, "lesson", right);
  const first = await finishSession(h.deps, session.attemptId);
  const second = await finishSession(h.deps, session.attemptId);
  assert.ok(first.ok && second.ok);
  assert.ok(first.data.moments.some((m) => m.kind === "unit_done"));
  assert.equal(first.data.path.unitDone, true);
  assert.deepEqual(second.data.moments, []);
});

// ---------- быстрая проверка ----------

test("check: 80%+ засчитывает урок сразу, даже закрытый (обходной путь), и даёт XP один раз", async () => {
  const locked: SkillAddress = { ...address, skillKey: "grammar.past_simple" };
  const h = createHarness(locked, { rows: [] });
  const plan = buildLessonPlan(findSkill(path, "grammar.past_simple")!, "check")!;
  const session = await playThrough(h, plan, "check", right);
  const done = await finishSession(h.deps, session.attemptId);
  assert.ok(done.ok);
  assert.equal(done.data.passed, true);
  assert.equal(done.data.lessonCompleted, true);
  assert.equal(done.data.xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
  assert.equal(h.rows.find((r) => r.skill_key === "grammar.past_simple")?.status, "confident");
});

test("check: 60% не засчитывает урок и не даёт XP, но отмечает практику", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, checkPlan, "check", (exercise, index) => (index < 3 ? right(exercise) : wrong(exercise)));
  const done = await finishSession(h.deps, session.attemptId);
  assert.ok(done.ok);
  assert.equal(done.data.passed, false);
  assert.equal(done.data.bucket, "mixed");
  assert.equal(done.data.lessonCompleted, false);
  assert.equal(done.data.xpAwarded, 0);
  assert.equal(h.rows.find((r) => r.skill_key === SKILL)?.status, "practicing");
});

test("check после ручного «Отметить как изученное»: слабый результат не откатывает урок, XP за навык ещё можно получить", async () => {
  const done = progressRow(SKILL, { status: "introduced", content_completed_at: "2025-01-01T00:00:00.000Z" });
  const h = createHarness(address, { rows: [done] });
  const weak = await playThrough(h, checkPlan, "check", wrong);
  const weakDone = await finishSession(h.deps, weak.attemptId);
  assert.ok(weakDone.ok);
  assert.equal(weakDone.data.lessonCompleted, true, "ранее пройденный урок остаётся пройденным");
  assert.equal(h.rows[0].content_completed_at, "2025-01-01T00:00:00.000Z");
  assert.equal(h.rewards.xpGrants.length, 0);

  const good = await playThrough(h, checkPlan, "check", right);
  const goodDone = await finishSession(h.deps, good.attemptId);
  assert.ok(goodDone.ok);
  assert.equal(goodDone.data.xpAwarded, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
});

// ---------- уроки без упражнений и устаревший план ----------

test("читательский урок без упражнений проходится шагами и засчитывается, XP — базовый", async () => {
  const key = "vocabulary.active_recall";
  const readingAddress: SkillAddress = { ...address, skillKey: key };
  const h = createHarness(readingAddress, { rows: rowsDoneBefore(key) });
  const plan = buildLessonPlan(findSkill(path, key)!, "lesson")!;
  assert.equal(plan.exerciseOrder.length, 0);

  const session = await playThrough(h, plan, "lesson", right);
  const done = await finishSession(h.deps, session.attemptId);
  assert.ok(done.ok);
  assert.equal(done.data.scoreRatio, null);
  assert.equal(done.data.passed, true);
  assert.equal(done.data.lessonCompleted, true);
  assert.equal(done.data.xpAwarded, LESSON_BASE_XP);
  assert.equal(h.rewards.firstWinSet, false, "без упражнений «первая победа» не засчитывается");
  assert.equal(h.rows.find((r) => r.skill_key === key)?.status, "introduced");
});

test("устаревший план: открытую попытку нельзя продолжить, но завершённый результат по-прежнему открывается", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  const done = await finishSession(h.deps, session.attemptId);
  assert.ok(done.ok);

  h.store.rows[0].signature = "old";
  const reopened = await finishSession(h.deps, session.attemptId);
  assert.ok(reopened.ok, "результат уже сохранён — экран завершения открывается и после обновления курса");
  assert.equal(reopened.data.xpAwarded, done.data.xpAwarded);

  const h2 = createHarness(address);
  const open = await begin(h2);
  h2.store.rows[0].signature = "old";
  const r = await advanceStep(h2.deps, open.attemptId, "content:intro");
  assert.deepEqual(r.ok ? null : r.code, "stale_plan");
});

test("finish: ошибка чтения при завершении → storage_failed без исключения", async () => {
  const h = createHarness(address);
  const session = await playThrough(h, lessonPlan, "lesson", right);
  h.store.failNext("findById");
  const r = await finishSession(h.deps, session.attemptId);
  assert.deepEqual(r.ok ? null : r.code, "storage_failed");
  assert.ok((await finishSession(h.deps, session.attemptId)).ok);
});

test("MemoryAttemptStore: держит те же ограничения, что и БД (одна открытая попытка, один claim XP)", async () => {
  const store = new MemoryAttemptStore("u");
  const a = await store.create({ ...address, mode: "lesson", stepsTotal: 3, signature: "s" });
  const b = await store.create({ ...address, mode: "lesson", stepsTotal: 3, signature: "s" });
  assert.equal(a.id, b.id, "вторая открытая попытка не создаётся");
  const c = await store.create({ ...address, mode: "check", stepsTotal: 3, signature: "s" });
  assert.notEqual(a.id, c.id, "а другой режим — отдельная попытка");
});
