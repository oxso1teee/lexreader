import { test } from "node:test";
import assert from "node:assert/strict";
import { dayLabel, groupXpHistory, toHistoryEvent } from "./history.ts";

const row = (id: string, source: string, amount: number, day: string, created_at: string, boosted = false) => ({ id, source, amount, boosted, day, created_at });

test("toHistoryEvent: подпись из каталога источников; неизвестный источник — «Другое»", () => {
  assert.equal(toHistoryEvent(row("1", "lesson_complete", 20, "2026-11-14", "2026-11-14T10:00:00Z")).label, "Урок пройден");
  assert.equal(toHistoryEvent(row("2", "quest_chest", 30, "2026-11-14", "2026-11-14T10:00:00Z")).label, "Сундук дня");
  assert.equal(toHistoryEvent(row("3", "something_old", 5, "2026-11-14", "2026-11-14T10:00:00Z")).label, "Другое");
});

test("groupXpHistory: дни по убыванию, суммы за день, порядок внутри дня сохраняется", () => {
  const events = [
    row("a", "review_card", 1, "2026-11-14", "2026-11-14T12:00:00Z"),
    row("b", "lesson_complete", 20, "2026-11-14", "2026-11-14T11:00:00Z"),
    row("c", "reading_session", 10, "2026-11-13", "2026-11-13T09:00:00Z"),
    row("d", "review_card", 2, "2026-11-14", "2026-11-14T10:00:00Z", true),
  ].map(toHistoryEvent);
  const days = groupXpHistory(events);
  assert.deepEqual(days.map((d) => [d.day, d.total]), [["2026-11-14", 23], ["2026-11-13", 10]]);
  assert.deepEqual(days[0].events.map((e) => e.id), ["a", "b", "d"]);
  assert.equal(days[0].events[2].boosted, true);
});

test("groupXpHistory: пустая история — пустой список", () => {
  assert.deepEqual(groupXpHistory([]), []);
});

test("dayLabel: сегодня, вчера, дата словами; граница месяца и года", () => {
  assert.equal(dayLabel("2026-11-14", "2026-11-14"), "Сегодня");
  assert.equal(dayLabel("2026-11-13", "2026-11-14"), "Вчера");
  assert.equal(dayLabel("2026-11-01", "2026-11-14"), "1 ноября");
  assert.equal(dayLabel("2025-12-31", "2026-01-01"), "Вчера");
  assert.equal(dayLabel("garbage", "2026-11-14"), "garbage");
});
