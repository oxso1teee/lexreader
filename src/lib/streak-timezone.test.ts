import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreakUpdate, type StreakProfileSnapshot } from "./streak-engine.ts";
import { userClock } from "./user-day.ts";

// Серия по календарю пользователя: то же, что делает touchStreak (streak.ts) —
// берёт today/yesterday/… из userClock(profiles.timezone) и отдаёт движку.

function snapshot(over: Partial<StreakProfileSnapshot> = {}): StreakProfileSnapshot {
  return {
    streakCurrent: 0,
    streakLongest: 0,
    lastActiveDate: null,
    freezeAvailable: true,
    freezeWeek: null,
    streakBeforeBreak: null,
    repairUntil: null,
    ...over,
  };
}

function touch(profile: StreakProfileSnapshot, tz: string | null, isoNow: string) {
  const c = userClock(tz, new Date(isoNow));
  return computeStreakUpdate(profile, c.today, c.yesterday, c.twoDaysAgo, c.weekStart);
}

/** Применяет результат к снимку, как это делает touchStreak (запись в profiles). */
function applied(profile: StreakProfileSnapshot, update: NonNullable<ReturnType<typeof computeStreakUpdate>>): StreakProfileSnapshot {
  return {
    streakCurrent: update.streakCurrent,
    streakLongest: update.streakLongest,
    lastActiveDate: update.lastActiveDate,
    freezeAvailable: update.freezeAvailable,
    freezeWeek: update.freezeWeek,
    streakBeforeBreak: update.streakBeforeBreak,
    repairUntil: update.repairUntil,
  };
}

test("первый активный день: серия 1, last_active_date — локальный день", () => {
  const update = touch(snapshot(), "Asia/Tokyo", "2026-11-14T20:00:00Z"); // в Токио уже 15-е
  assert.ok(update);
  assert.equal(update.streakCurrent, 1);
  assert.equal(update.lastActiveDate, "2026-11-15");
});

test("повторная активность в тот же локальный день серию не увеличивает", () => {
  const first = touch(snapshot(), "Europe/Moscow", "2026-06-14T10:00:00Z");
  assert.ok(first);
  const state = applied(snapshot(), first);
  assert.equal(touch(state, "Europe/Moscow", "2026-06-14T12:00:00Z"), null);
  assert.equal(touch(state, "Europe/Moscow", "2026-06-14T20:59:59Z"), null, "за секунду до локальной полуночи");
});

test("переход через ЛОКАЛЬНУЮ полночь: следующий календарный день — серия +1 ровно один раз", () => {
  const day1 = touch(snapshot(), "Europe/Moscow", "2026-06-14T10:00:00Z");
  assert.ok(day1);
  const state = applied(snapshot(), day1);
  const next = touch(state, "Europe/Moscow", "2026-06-14T21:00:00Z"); // 00:00 15 июня в Москве
  assert.ok(next);
  assert.equal(next.streakCurrent, 2);
  assert.equal(next.lastActiveDate, "2026-06-15");
  assert.equal(touch(applied(state, next), "Europe/Moscow", "2026-06-14T22:00:00Z"), null, "и второй раз в тот же день — нет");
});

test("тот же момент: в UTC это ещё один день, в Токио — уже следующий (разница именно в поясе)", () => {
  const state = snapshot({ streakCurrent: 3, streakLongest: 3, lastActiveDate: "2026-11-14" });
  assert.equal(touch(state, "UTC", "2026-11-14T23:00:00Z"), null, "UTC: всё ещё 14-е");
  const tokyo = touch(state, "Asia/Tokyo", "2026-11-14T23:00:00Z"); // Токио: 15-е 08:00
  assert.ok(tokyo);
  assert.equal(tokyo.streakCurrent, 4);
});

test("пропущенный день: серия обрывается (Earn-back предлагается для серии >1)", () => {
  const state = snapshot({ streakCurrent: 5, streakLongest: 5, lastActiveDate: "2026-11-10", freezeAvailable: false, freezeWeek: "2026-11-09" });
  const update = touch(state, "UTC", "2026-11-13T09:00:00Z"); // пропущены 11-е и 12-е
  assert.ok(update);
  assert.equal(update.streakCurrent, 1);
  assert.equal(update.repairStarted, true);
  assert.equal(update.streakBeforeBreak, 5);
});

test("возобновление после перерыва: новая серия с 1, максимум сохраняется", () => {
  const state = snapshot({ streakCurrent: 1, streakLongest: 12, lastActiveDate: "2026-10-01", freezeAvailable: false, freezeWeek: "2026-09-28" });
  const update = touch(state, "Europe/Moscow", "2026-11-14T10:00:00Z");
  assert.ok(update);
  assert.equal(update.streakCurrent, 1);
  assert.equal(update.streakLongest, 12);
});

test("ПЕРЕЛЁТ НА ЗАПАД: локальная дата раньше сохранённой — серия не обрывается и не растёт", () => {
  // активен в Токио 15-го; затем «сегодня» по часам Лос-Анджелеса — ещё 14-е
  const state = snapshot({ streakCurrent: 10, streakLongest: 10, lastActiveDate: "2026-11-15" });
  assert.equal(touch(state, "America/Los_Angeles", "2026-11-15T05:00:00Z"), null);
  // без защиты это выглядело бы как «настоящий обрыв» и обнулило бы серию
  const c = userClock("America/Los_Angeles", new Date("2026-11-15T05:00:00Z"));
  assert.equal(c.today, "2026-11-14");
  assert.ok(c.today < state.lastActiveDate!);
});

test("после перелёта на запад серия продолжается, когда локальный день наконец наступает", () => {
  const state = snapshot({ streakCurrent: 10, streakLongest: 10, lastActiveDate: "2026-11-15" });
  assert.equal(touch(state, "America/Los_Angeles", "2026-11-15T20:00:00Z"), null, "в Лос-Анджелесе 15-е 12:00 — тот же день");
  const next = touch(state, "America/Los_Angeles", "2026-11-16T09:00:00Z"); // LA: 16-е 01:00
  assert.ok(next);
  assert.equal(next.streakCurrent, 11);
});

test("перелёт на восток: пропускается не более одного календарного дня — заморозка спасает ровно его", () => {
  const state = snapshot({ streakCurrent: 4, streakLongest: 4, lastActiveDate: "2026-11-10", freezeAvailable: true });
  const update = touch(state, "UTC", "2026-11-12T09:00:00Z"); // пропущен ровно 11-е
  assert.ok(update);
  assert.equal(update.usedFreeze, true);
  assert.equal(update.streakCurrent, 5);
  assert.equal(update.frozenDay, "2026-11-11");
});

test("неизвестный пояс в профиле → считаем по UTC, без ошибок", () => {
  const state = snapshot({ streakCurrent: 2, streakLongest: 2, lastActiveDate: "2026-11-13" });
  const update = touch(state, "Mars/Olympus", "2026-11-14T01:00:00Z");
  assert.ok(update);
  assert.equal(update.lastActiveDate, "2026-11-14");
});

test("серия у существующего аккаунта без пояса (null) считается как раньше — по UTC", () => {
  const state = snapshot({ streakCurrent: 6, streakLongest: 6, lastActiveDate: "2026-11-13" });
  const update = touch(state, null, "2026-11-14T00:00:01Z");
  assert.ok(update);
  assert.equal(update.streakCurrent, 7);
});
