import { test } from "node:test";
import assert from "node:assert/strict";
import { goalDoneInfo, syncGoalProgress, type GoalSyncPorts, type GoalSyncProfile } from "./goal-sync.ts";
import type { DailyActivity } from "./activity.ts";
import { MemoryLedger } from "../xp/testing/memory-ledger.ts";

const U = "user-1";
const NOW = new Date("2026-11-14T12:00:00Z");

function activity(overrides: Partial<DailyActivity> = {}): DailyActivity {
  return { day: "2026-11-14", xp: 0, readingMinutes: 0, reviewedWords: 0, correctStreak: 0, lessons: 0, exercises: 0, ...overrides };
}

function harness(profile: Partial<GoalSyncProfile> = {}, initial: Partial<DailyActivity> = {}) {
  const ledger = new MemoryLedger();
  ledger.addProfile(U, { today: "2026-11-14" });
  const state = {
    profile: { timezone: null, target_language: "en", daily_xp_goal: 50, daily_goal_type: "lessons", daily_goal_target: 2, ...profile } as GoalSyncProfile | null,
    activity: activity(initial),
    calls: { activity: 0, mark: 0, met: 0 },
  };
  const ports: GoalSyncPorts = {
    loadProfile: async () => state.profile,
    isGoalMet: async (_u, day) => {
      state.calls.met++;
      return ledger.goalMet(U, day);
    },
    loadActivity: async (_u, day) => {
      state.calls.activity++;
      return { ...state.activity, day };
    },
    markGoalMet: async (u, day) => {
      state.calls.mark++;
      await Promise.resolve();
      return ledger.markGoalMet(u, day);
    },
  };
  return { ledger, state, ports };
}

test("цель «уроки»: пока не достигнута — отметки нет; достигнута — день отмечен и момент положен ровно один раз", async () => {
  const h = harness({}, { lessons: 1 });
  const before = await syncGoalProgress(h.ports, U, { now: NOW });
  assert.ok(before);
  assert.equal(before.justCompleted, false);
  assert.equal(before.progress?.current, 1);
  assert.equal(h.ledger.goalMet(U, "2026-11-14"), false);
  assert.equal(goalDoneInfo(before), null);

  h.state.activity = activity({ lessons: 2 });
  const done = await syncGoalProgress(h.ports, U, { now: NOW });
  assert.ok(done && done.justCompleted);
  assert.equal(h.ledger.goalMet(U, "2026-11-14"), true);
  assert.deepEqual(goalDoneInfo(done)?.goal, { type: "lessons", current: 2, target: 2, unit: "уроков", label: "уроков сегодня" });

  const again = await syncGoalProgress(h.ports, U, { now: NOW });
  assert.equal(again?.justCompleted, false, "повтор не создаёт второй момент");
  assert.equal(h.state.calls.mark, 1, "повтор даже не доходит до БД: день уже отмечен");
});

test("параллельные завершения: момент достаётся ровно одному", async () => {
  const h = harness({}, { lessons: 5 });
  // обойти раннюю проверку isGoalMet — гонка двух запросов, оба видят «ещё не выполнено»
  h.ports.isGoalMet = async () => false;
  const results = await Promise.all(Array.from({ length: 8 }, () => syncGoalProgress(h.ports, U, { now: NOW })));
  assert.equal(results.filter((r) => r?.justCompleted).length, 1);
  assert.equal(h.state.calls.mark, 8);
});

test("каждый тип цели читает свою метрику", async () => {
  const cases: Array<[GoalSyncProfile["daily_goal_type"], number, Partial<DailyActivity>, Partial<DailyActivity>]> = [
    ["exercises", 10, { exercises: 9 }, { exercises: 10 }],
    ["reading_minutes", 10, { readingMinutes: 9 }, { readingMinutes: 10 }],
    ["words", 20, { reviewedWords: 19 }, { reviewedWords: 20 }],
    ["lessons", 1, { lessons: 0 }, { lessons: 1 }],
  ];
  for (const [type, target, below, reached] of cases) {
    const h = harness({ daily_goal_type: type, daily_goal_target: target }, below);
    assert.equal((await syncGoalProgress(h.ports, U, { now: NOW }))?.justCompleted, false, `${type} ниже цели`);
    h.state.activity = activity(reached);
    assert.equal((await syncGoalProgress(h.ports, U, { now: NOW }))?.justCompleted, true, `${type} достигнута`);
  }
});

test("XP-цель из потока начисления не считается: отметку ставит award_xp", async () => {
  const h = harness({ daily_goal_type: "xp", daily_goal_target: null }, { xp: 500 });
  const result = await syncGoalProgress(h.ports, U, { now: NOW });
  assert.equal(result?.justCompleted, false);
  assert.equal(result?.progress, null);
  assert.equal(h.state.calls.activity, 0, "лишних запросов нет");
  assert.equal(h.ledger.goalMet(U, "2026-11-14"), false);
});

test("смена цели «уроки» → «XP» при набранном дне: отметка ставится по новой цели, момент не нужен", async () => {
  const h = harness({ daily_goal_type: "xp", daily_goal_target: null, daily_xp_goal: 50 }, { xp: 60 });
  const result = await syncGoalProgress(h.ports, U, { now: NOW, includeXp: true });
  assert.equal(h.ledger.goalMet(U, "2026-11-14"), true, "день отмечен по XP-цели");
  assert.equal(goalDoneInfo(result), null, "для XP-цели момент строится из начисления, а не отсюда");
});

test("день — по поясу пользователя", async () => {
  const h = harness({ timezone: "Asia/Tokyo" }, { lessons: 3 });
  const result = await syncGoalProgress(h.ports, U, { now: new Date("2026-11-14T20:00:00Z") });
  assert.equal(result?.day, "2026-11-15", "в Токио уже 15-е");
  assert.equal(h.ledger.goalMet(U, "2026-11-15"), true);
  assert.equal(h.ledger.goalMet(U, "2026-11-14"), false);
});

test("отметка монотонна: понижение факта в течение дня её не снимает, а повторный вызов дешёвый", async () => {
  const h = harness({}, { lessons: 2 });
  await syncGoalProgress(h.ports, U, { now: NOW });
  h.state.activity = activity({ lessons: 0 });
  const again = await syncGoalProgress(h.ports, U, { now: NOW });
  assert.equal(again?.justCompleted, false);
  assert.equal(h.ledger.goalMet(U, "2026-11-14"), true);
  assert.equal(h.state.calls.activity, 1, "второй раз прогресс заново не считали");
});

test("нет профиля — null; сбой порта пробрасывается (серверная обёртка его логирует)", async () => {
  const none = harness();
  none.state.profile = null;
  assert.equal(await syncGoalProgress(none.ports, U, { now: NOW }), null);
  const broken = harness({}, { lessons: 2 });
  broken.ports.markGoalMet = async () => {
    throw new Error("rpc down");
  };
  await assert.rejects(() => syncGoalProgress(broken.ports, U, { now: NOW }), /rpc down/);
  assert.equal(broken.ledger.goalMet(U, "2026-11-14"), false, "после сбоя ничего не отмечено — следующий вызов повторит");
});

test("goalDoneInfo: только для закрытой этим вызовом цели не в XP", () => {
  const progress = { type: "words", current: 20, target: 20, unitMany: "слов", tileLabel: "слов сегодня", xpToday: 33, xpGoal: 50 } as never;
  assert.ok(goalDoneInfo({ day: "d", goalType: "words", progress, justCompleted: true }));
  assert.equal(goalDoneInfo({ day: "d", goalType: "words", progress, justCompleted: false }), null);
  assert.equal(goalDoneInfo({ day: "d", goalType: "xp", progress, justCompleted: true }), null);
  assert.equal(goalDoneInfo(null), null);
});

test("идеальная неделя следует выбранной цели: XP сверх XP-цели неделю не закрывает, выполненные «уроки» — закрывают", async () => {
  const { isPerfectWeek } = await import("../moments/perfect-week.ts");
  const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  const h = harness({ daily_goal_type: "lessons", daily_goal_target: 1, daily_xp_goal: 20 });
  const marks = () => week.map((day) => ({ goalMet: h.ledger.goalMet(U, day), freezeUsed: false }));

  // каждый день набрано 100 XP (в 5 раз больше XP-цели), но ни одного урока
  for (const day of week) {
    h.ledger.profiles.get(U)!.today = day;
    await import("../xp/award.ts").then(({ awardXp }) => awardXp(U, { source: "lesson_complete", ref: `a-${day}`, amount: 25 }, h.ledger.rpc));
  }
  assert.equal(isPerfectWeek(marks()), false, "XP-цель тут ни при чём");

  // теперь в каждый день зачтён урок
  for (const day of week) {
    h.state.activity = activity({ lessons: 1, day });
    await syncGoalProgress(h.ports, U, { now: new Date(`${day}T12:00:00Z`) });
  }
  assert.equal(isPerfectWeek(marks()), true);
});
