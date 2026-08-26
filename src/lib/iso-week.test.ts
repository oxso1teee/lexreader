import { test } from "node:test";
import assert from "node:assert/strict";
import { isoWeekStart } from "./iso-week.ts";

test("isoWeekStart(): a Wednesday rolls back to that week's Monday at UTC midnight", () => {
  // 2026-08-26 is a Wednesday.
  const result = isoWeekStart(new Date("2026-08-26T15:42:07.123Z"));
  assert.equal(result.toISOString(), "2026-08-24T00:00:00.000Z");
});

test("isoWeekStart(): a Monday stays on itself, time truncated to midnight", () => {
  const result = isoWeekStart(new Date("2026-08-24T23:59:59.999Z"));
  assert.equal(result.toISOString(), "2026-08-24T00:00:00.000Z");
});

test("isoWeekStart(): a Sunday rolls back to the PREVIOUS Monday (ISO week, not calendar-week-starts-Sunday)", () => {
  // 2026-08-30 is a Sunday — the end of the same ISO week that started 08-24.
  const result = isoWeekStart(new Date("2026-08-30T00:00:00.000Z"));
  assert.equal(result.toISOString(), "2026-08-24T00:00:00.000Z");
});

test("isoWeekStart(): does not mutate the input Date", () => {
  const input = new Date("2026-08-26T15:42:07.123Z");
  const originalIso = input.toISOString();
  isoWeekStart(input);
  assert.equal(input.toISOString(), originalIso);
});

test("isoWeekStart(): every day within the same ISO week maps to the same Monday", () => {
  const days = [
    "2026-08-24T01:00:00.000Z",
    "2026-08-25T12:00:00.000Z",
    "2026-08-26T23:00:00.000Z",
    "2026-08-27T00:00:01.000Z",
    "2026-08-28T18:30:00.000Z",
    "2026-08-29T06:15:00.000Z",
    "2026-08-30T21:59:59.000Z",
  ];
  const mondays = new Set(days.map((d) => isoWeekStart(new Date(d)).toISOString()));
  assert.equal(mondays.size, 1, "every day of the same ISO week must resolve to the same Monday");
  assert.ok(mondays.has("2026-08-24T00:00:00.000Z"));
});
