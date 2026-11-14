import { test } from "node:test";
import assert from "node:assert/strict";
import { countSince, lastActivityLabel, readingMinutesSince, summarizeToday } from "./today-summary.ts";

const DAY_START = Date.parse("2026-11-13T00:00:00Z");

test("readingMinutesSince(): суммирует только завершённые сессии, начатые сегодня", () => {
  const minutes = readingMinutesSince(
    [
      { started_at: "2026-11-13T08:00:00Z", ended_at: "2026-11-13T08:12:00Z" }, // 12
      { started_at: "2026-11-13T09:00:00Z", ended_at: "2026-11-13T09:05:30Z" }, // 5.5 → 6
      { started_at: "2026-11-13T10:00:00Z", ended_at: null }, // не завершена
      { started_at: "2026-11-12T23:50:00Z", ended_at: "2026-11-13T00:30:00Z" }, // начата вчера
    ],
    DAY_START,
  );
  assert.equal(minutes, 18);
});

test("readingMinutesSince(): пусто, битые даты и отрицательная длительность дают 0", () => {
  assert.equal(readingMinutesSince([], DAY_START), 0);
  assert.equal(readingMinutesSince([{ started_at: "oops", ended_at: "2026-11-13T09:00:00Z" }], DAY_START), 0);
  assert.equal(
    readingMinutesSince([{ started_at: "2026-11-13T09:00:00Z", ended_at: "2026-11-13T08:00:00Z" }], DAY_START),
    0,
  );
});

test("countSince(): считает отметки не раньше границы и пропускает битые", () => {
  assert.equal(
    countSince(["2026-11-12T23:59:59Z", "2026-11-13T00:00:00Z", "2026-11-13T12:00:00Z", "мусор"], DAY_START),
    2,
  );
  assert.equal(countSince([], DAY_START), 0);
});

test("summarizeToday(): склоняет слова и не выводит нули", () => {
  assert.deepEqual(summarizeToday({ readingMinutes: 12, reviews: 18, newWords: 9 }), [
    "12 мин чтения",
    "18 повторений",
    "9 новых слов",
  ]);
  assert.deepEqual(summarizeToday({ readingMinutes: 0, reviews: 1, newWords: 1 }), ["1 повторение", "1 новое слово"]);
  assert.deepEqual(summarizeToday({ readingMinutes: 0, reviews: 2, newWords: 3 }), ["2 повторения", "3 новых слова"]);
  assert.deepEqual(summarizeToday({ readingMinutes: 0, reviews: 0, newWords: 0 }), []);
});

test("lastActivityLabel(): сегодня, вчера и «N дней назад» с правильным склонением", () => {
  const now = new Date("2026-11-13T10:00:00Z");
  assert.equal(lastActivityLabel("2026-11-13", now), "сегодня");
  assert.equal(lastActivityLabel("2026-11-12", now), "вчера");
  assert.equal(lastActivityLabel("2026-11-11", now), "2 дня назад");
  assert.equal(lastActivityLabel("2026-11-08", now), "5 дней назад");
  assert.equal(lastActivityLabel("2026-10-23", now), "21 день назад");
});

test("lastActivityLabel(): активности не было или дата из будущего — null", () => {
  const now = new Date("2026-11-13T10:00:00Z");
  assert.equal(lastActivityLabel(null, now), null);
  assert.equal(lastActivityLabel("2026-11-20", now), null);
});
