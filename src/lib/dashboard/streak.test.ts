import { test } from "node:test";
import assert from "node:assert/strict";
import { streakDisplay } from "./streak.ts";

// Пятница, 13 ноября 2026 (UTC). Неделя началась в понедельник 2026-11-09.
const NOW = new Date("2026-11-13T10:00:00Z");

const base = { streakCurrent: 12, lastActiveDate: "2026-11-13", freezeAvailable: true, freezeWeek: null };

test("streakDisplay(): серии нет — 0 и состояние none, даже если дата активности странная", () => {
  assert.deepEqual(streakDisplay({ ...base, streakCurrent: 0 }, NOW), { value: 0, state: "none" });
  assert.deepEqual(streakDisplay({ ...base, streakCurrent: 0, lastActiveDate: null }, NOW), { value: 0, state: "none" });
  assert.deepEqual(streakDisplay({ ...base, streakCurrent: Number.NaN }, NOW), { value: 0, state: "none" });
});

test("streakDisplay(): занимался сегодня — серия продлена", () => {
  assert.deepEqual(streakDisplay(base, NOW), { value: 12, state: "extended" });
});

test("streakDisplay(): занимался вчера — серия жива, нужно продлить сегодня", () => {
  assert.deepEqual(streakDisplay({ ...base, lastActiveDate: "2026-11-12" }, NOW), { value: 12, state: "alive" });
});

test("streakDisplay(): пропущен один день и заморозка свободна — серия под защитой заморозки", () => {
  // freezeWeek не равна текущей неделе → заморозка считается свободной.
  assert.deepEqual(streakDisplay({ ...base, lastActiveDate: "2026-11-11", freezeWeek: "2026-11-02" }, NOW), {
    value: 12,
    state: "frozen",
  });
  // На этой неделе заморозка ещё не тратилась.
  assert.deepEqual(
    streakDisplay({ ...base, lastActiveDate: "2026-11-11", freezeWeek: "2026-11-09", freezeAvailable: true }, NOW),
    { value: 12, state: "frozen" },
  );
});

test("streakDisplay(): пропущен один день, но заморозка этой недели уже потрачена — серия прервана", () => {
  assert.deepEqual(
    streakDisplay({ ...base, lastActiveDate: "2026-11-11", freezeWeek: "2026-11-09", freezeAvailable: false }, NOW),
    { value: 0, state: "broken" },
  );
});

test("streakDisplay(): пропущено два и больше дней — заморозка не спасает, показываем 0", () => {
  for (const last of ["2026-11-10", "2026-11-01", "2026-06-01"]) {
    assert.deepEqual(streakDisplay({ ...base, lastActiveDate: last, freezeWeek: null }, NOW), { value: 0, state: "broken" }, last);
  }
});

test("streakDisplay(): нет даты последней активности при ненулевой серии — не выдумываем обрыв", () => {
  assert.deepEqual(streakDisplay({ ...base, lastActiveDate: null }, NOW), { value: 12, state: "alive" });
});

test("streakDisplay(): неделя считается по понедельнику — потраченная заморозка действует до воскресенья и освобождается в понедельник", () => {
  // Воскресенье 15-го — та же ISO-неделя, что и понедельник 9-го; позавчера — 13-е.
  const sunday = new Date("2026-11-15T20:00:00Z");
  const spent = { ...base, lastActiveDate: "2026-11-13", freezeWeek: "2026-11-09", freezeAvailable: false };
  assert.deepEqual(streakDisplay(spent, sunday), { value: 0, state: "broken" });

  // Понедельник 16-го открывает новую неделю: заморозка снова свободна, позавчера — 14-е.
  const monday = new Date("2026-11-16T08:00:00Z");
  assert.deepEqual(streakDisplay({ ...spent, lastActiveDate: "2026-11-14" }, monday), { value: 12, state: "frozen" });
});
