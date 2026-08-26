import { test } from "node:test";
import assert from "node:assert/strict";
import { describeLeaderboardEmptyState, LEADERBOARD_EMPTY_MESSAGE, LEADERBOARD_OPT_IN_NUDGE, type LeaderboardRow } from "./leaderboard.ts";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "честная пустая механика: если лидерборд пуст ... не подделывай
// ботов/фейковые записи, покажи честное пустое состояние" — каждая ветка
// ниже проверяет ровно один правдивый случай, ни один не порождает данные.
// Independent of the *viewer's* own opt-in status on purpose — the RPC
// already decides which rows are safe to return regardless of who's
// asking; seeing the league and joining it are two separate decisions
// (LEADERBOARD_OPT_IN_NUDGE is the separate, non-replacing invite).

function row(overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return { rank: 1, isYou: false, initials: "AB", reviewsCount: 3, wordsCount: 2, score: 5, ...overrides };
}

test("describeLeaderboardEmptyState(): zero rows — nobody has scored yet this week", () => {
  assert.equal(describeLeaderboardEmptyState([]), "no_activity_yet");
});

test("describeLeaderboardEmptyState(): exactly one row that is you — alone, not a real leaderboard yet", () => {
  assert.equal(describeLeaderboardEmptyState([row({ isYou: true })]), "alone");
});

test("describeLeaderboardEmptyState(): exactly one row that is NOT you — a real other participant, not the 'alone' case", () => {
  assert.equal(describeLeaderboardEmptyState([row({ isYou: false })]), null);
});

test("describeLeaderboardEmptyState(): two or more rows — a real leaderboard, no empty state", () => {
  assert.equal(describeLeaderboardEmptyState([row({ isYou: true, rank: 1 }), row({ isYou: false, rank: 2 })]), null);
});

test("LEADERBOARD_EMPTY_MESSAGE: every reason has a distinct, non-empty Russian message", () => {
  const messages = Object.values(LEADERBOARD_EMPTY_MESSAGE);
  assert.equal(messages.length, 2);
  assert.equal(new Set(messages).size, 2, "each empty-state reason must have its own distinct message");
  for (const m of messages) assert.ok(m.length > 10);
});

test("LEADERBOARD_OPT_IN_NUDGE: a real, non-empty message, distinct from the empty-state messages", () => {
  assert.ok(LEADERBOARD_OPT_IN_NUDGE.length > 10);
  assert.ok(!Object.values(LEADERBOARD_EMPTY_MESSAGE).includes(LEADERBOARD_OPT_IN_NUDGE));
});
