import { test } from "node:test";
import assert from "node:assert/strict";
import { GOAL_TYPES, GOAL_TYPE_DEFS, formatGoalAmount, isGoalType, resolveGoalConfig, validateGoalChoice } from "./config.ts";
import { longestCorrectRun, summarizeActivity } from "./activity.ts";
import { dailyGoalProgress, goalProgressFor } from "../dashboard/goal.ts";
import { DAILY_XP_GOAL_PRESETS } from "../daily-goal.ts";

// ---------- конфиг цели ----------

test("каждый тип цели имеет пресеты, значение по умолчанию из пресетов и единицу", () => {
  for (const type of GOAL_TYPES) {
    const def = GOAL_TYPE_DEFS[type];
    assert.ok(def.presets.length >= 3, type);
    assert.ok(def.presets.includes(def.defaultTarget), `${type}: default из пресетов`);
    assert.ok(def.unit(def.defaultTarget).length > 0);
    assert.ok(def.title.length > 0 && def.tileLabel.length > 0);
  }
  assert.deepEqual([...GOAL_TYPE_DEFS.xp.presets], DAILY_XP_GOAL_PRESETS.map((p) => p.xp), "XP-пресеты — те же, что в онбординге");
});

test("resolveGoalConfig: существующий выбор онбординга (XP) сохраняется как есть", () => {
  assert.deepEqual(resolveGoalConfig({ daily_xp_goal: 80 }), { type: "xp", target: 80 });
  assert.deepEqual(resolveGoalConfig({ daily_goal_type: "xp", daily_goal_target: null, daily_xp_goal: 120 }), { type: "xp", target: 120 });
  assert.deepEqual(resolveGoalConfig({ daily_goal_type: "xp", daily_goal_target: 7, daily_xp_goal: 50 }), { type: "xp", target: 50 }, "для XP размер — daily_xp_goal");
});

test("resolveGoalConfig: другой тип берёт свой размер; битые значения заменяются безопасными", () => {
  assert.deepEqual(resolveGoalConfig({ daily_goal_type: "lessons", daily_goal_target: 2, daily_xp_goal: 50 }), { type: "lessons", target: 2 });
  assert.deepEqual(resolveGoalConfig({ daily_goal_type: "words", daily_goal_target: null, daily_xp_goal: 50 }), { type: "words", target: 20 });
  assert.deepEqual(resolveGoalConfig({ daily_goal_type: "words", daily_goal_target: -3, daily_xp_goal: 50 }), { type: "words", target: 20 });
  assert.deepEqual(resolveGoalConfig({ daily_goal_type: "hacked", daily_goal_target: 5, daily_xp_goal: 50 }), { type: "xp", target: 50 });
  assert.deepEqual(resolveGoalConfig({}), { type: "xp", target: 50 });
  assert.deepEqual(resolveGoalConfig({ daily_xp_goal: 0 }), { type: "xp", target: 50 });
});

test("validateGoalChoice: тип известен и размер — один из пресетов этого типа", () => {
  assert.deepEqual(validateGoalChoice("lessons", 2), { ok: true, type: "lessons", target: 2 });
  assert.deepEqual(validateGoalChoice("xp", 80), { ok: true, type: "xp", target: 80 });
  const bad: Array<[unknown, unknown]> = [
    ["lessons", 7], ["xp", 51], ["xp", 0], ["words", -10], ["words", 10.5], ["words", "10"], ["nope", 1], [undefined, 5],
    ["lessons", Number.NaN], ["constructor", 1], ["lessons", null],
  ];
  for (const [type, target] of bad) assert.deepEqual(validateGoalChoice(type, target), { ok: false }, `${String(type)}/${String(target)}`);
});

test("isGoalType/formatGoalAmount: русские формы единиц", () => {
  assert.equal(isGoalType("xp"), true);
  assert.equal(isGoalType("constructor"), false);
  assert.equal(formatGoalAmount("lessons", 1), "1 урок");
  assert.equal(formatGoalAmount("lessons", 2), "2 урока");
  assert.equal(formatGoalAmount("lessons", 5), "5 уроков");
  assert.equal(formatGoalAmount("words", 21), "21 слово");
  assert.equal(formatGoalAmount("exercises", 12), "12 упражнений");
  assert.equal(formatGoalAmount("reading_minutes", 10), "10 мин");
  assert.equal(formatGoalAmount("xp", 50), "50 XP");
});

// ---------- прогресс по типам ----------

const activity = { xp: 35, readingMinutes: 12, reviewedWords: 8, lessons: 1, exercises: 7 };

test("прогресс XP-цели: поля прежнего dailyGoalProgress сохранены, добавлены обобщённые", () => {
  const p = dailyGoalProgress(30, 50);
  assert.equal(p.xpToday, 30);
  assert.equal(p.xpGoal, 50);
  assert.equal(p.type, "xp");
  assert.equal(p.current, 30);
  assert.equal(p.target, 50);
  assert.equal(p.remaining, 20);
  assert.equal(p.unit, "XP");
  assert.equal(p.tileLabel, "XP сегодня");
});

test("прогресс по каждому типу берёт СВОЮ метрику; xpToday всегда остаётся XP", () => {
  const lessons = goalProgressFor({ type: "lessons", target: 2 }, activity, 50);
  assert.deepEqual([lessons.current, lessons.target, lessons.percent, lessons.remaining, lessons.done], [1, 2, 50, 1, false]);
  assert.equal(lessons.xpToday, 35);
  const exercises = goalProgressFor({ type: "exercises", target: 5 }, activity, 50);
  assert.deepEqual([exercises.current, exercises.done, exercises.percent], [7, true, 100]);
  const reading = goalProgressFor({ type: "reading_minutes", target: 20 }, activity, 50);
  assert.deepEqual([reading.current, reading.remaining, reading.unit], [12, 8, "мин"]);
  const words = goalProgressFor({ type: "words", target: 10 }, activity, 50);
  assert.deepEqual([words.current, words.remaining, words.done], [8, 2, false]);
  assert.equal(words.unit, "слов");
});

test("перевыполнение не выводит долю выше 1; пустая активность — ноль и не готово", () => {
  const over = goalProgressFor({ type: "exercises", target: 5 }, { ...activity, exercises: 50 }, 50);
  assert.equal(over.value, 1);
  assert.equal(over.percent, 100);
  assert.equal(over.remaining, 0);
  assert.equal(over.current, 50, "сколько сделано на самом деле — показываем как есть");
  const empty = goalProgressFor({ type: "lessons", target: 1 }, { xp: 0, readingMinutes: 0, reviewedWords: 0, lessons: 0, exercises: 0 }, 50);
  assert.deepEqual([empty.value, empty.done, empty.remaining], [0, false, 1]);
});

test("битая цель (0/NaN) не даёт деления на ноль", () => {
  const p = goalProgressFor({ type: "words", target: 0 }, activity, 50);
  assert.equal(p.target, 20);
  assert.ok(Number.isFinite(p.value));
  const q = goalProgressFor({ type: "xp", target: Number.NaN }, activity, Number.NaN);
  assert.ok(Number.isFinite(q.value) && q.target > 0 && q.xpGoal > 0);
});

// ---------- сводка активности ----------

test("longestCorrectRun: самая длинная серия grade>=2, ошибка обнуляет", () => {
  assert.equal(longestCorrectRun([]), 0);
  assert.equal(longestCorrectRun([2, 3, 3, 0, 2, 2, 2, 2, 1, 3]), 4);
  assert.equal(longestCorrectRun([0, 1, 0]), 0);
});

test("summarizeActivity: минуты чтения, разные карточки, серия, разные уроки, упражнения", () => {
  const result = summarizeActivity({
    day: "2026-11-14",
    xp: 42,
    sessions: [
      { started_at: "2026-11-14T08:00:00Z", ended_at: "2026-11-14T08:10:00Z" },
      { started_at: "2026-11-14T09:00:00Z", ended_at: "2026-11-14T09:05:30Z" },
      { started_at: "2026-11-14T10:00:00Z", ended_at: null },
    ],
    reviews: [
      { flashcard_id: "a", grade: 3 }, { flashcard_id: "b", grade: 2 }, { flashcard_id: "a", grade: 3 },
      { flashcard_id: "c", grade: 0 }, { flashcard_id: "d", grade: 3 },
    ],
    attempts: [
      { mode: "lesson", path_slug: "a2-b1", skill_key: "grammar.articles", passed: true, correct_count: 5, incorrect_count: 2 },
      { mode: "lesson", path_slug: "a2-b1", skill_key: "grammar.articles", passed: true, correct_count: 7, incorrect_count: 0 },
      { mode: "lesson", path_slug: "a2-b1", skill_key: "grammar.modals", passed: false, correct_count: 1, incorrect_count: 4 },
      { mode: "check", path_slug: "a2-b1", skill_key: "grammar.tenses", passed: true, correct_count: 4, incorrect_count: 1 },
    ],
  });
  assert.equal(result.xp, 42);
  assert.equal(result.readingMinutes, 16, "10 + 5,5 минуты, незавершённая сессия не считается");
  assert.equal(result.reviewedWords, 4, "a повторялась дважды — одно слово");
  assert.equal(result.correctStreak, 3);
  assert.equal(result.lessons, 1, "тот же урок дважды — один; проваленный и проверка знаний не считаются");
  assert.equal(result.exercises, 24, "все выполненные упражнения завершённых попыток, включая проверки");
});

test("summarizeActivity: пустой и битый ввод не ломает сводку", () => {
  const empty = summarizeActivity({ day: "2026-11-14", xp: undefined, sessions: [], reviews: [], attempts: [] });
  assert.deepEqual(empty, { day: "2026-11-14", xp: 0, readingMinutes: 0, reviewedWords: 0, correctStreak: 0, lessons: 0, exercises: 0 });
  const weird = summarizeActivity({
    day: "d",
    xp: -5,
    sessions: [{ started_at: "2026-11-14T10:00:00Z", ended_at: "2026-11-14T09:00:00Z" }, { started_at: "garbage", ended_at: "garbage" }],
    reviews: [],
    attempts: [{ mode: "lesson", path_slug: "p", skill_key: "s", passed: null, correct_count: -1, incorrect_count: Number.NaN }],
  });
  assert.deepEqual([weird.xp, weird.readingMinutes, weird.exercises, weird.lessons], [0, 0, 0, 0]);
});
