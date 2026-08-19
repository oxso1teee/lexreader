import test from "node:test";
import assert from "node:assert/strict";
import { buildLeaderboardRows, anonymizedInitials, rankFromHigherCount } from "./arena.ts";

test("buildLeaderboardRows orders by xp descending and assigns 1-based ranks", () => {
  const rows = buildLeaderboardRows(
    [
      { id: "a", xp: 100 },
      { id: "b", xp: 500 },
      { id: "c", xp: 250 },
    ],
    "b",
  );
  assert.deepEqual(rows.map((r) => r.id), ["b", "c", "a"]);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
});

test("buildLeaderboardRows marks exactly the current user's row", () => {
  const rows = buildLeaderboardRows(
    [
      { id: "a", xp: 100 },
      { id: "b", xp: 500 },
    ],
    "a",
  );
  const a = rows.find((r) => r.id === "a");
  const b = rows.find((r) => r.id === "b");
  assert.equal(a?.isCurrentUser, true);
  assert.equal(b?.isCurrentUser, false);
});

test("buildLeaderboardRows never mutates the input array", () => {
  const input = [
    { id: "a", xp: 100 },
    { id: "b", xp: 500 },
  ];
  buildLeaderboardRows(input, "a");
  assert.deepEqual(input, [
    { id: "a", xp: 100 },
    { id: "b", xp: 500 },
  ]);
});

test("anonymizedInitials derives a stable 2-letter label from an id, never from email/name", () => {
  assert.equal(anonymizedInitials("abcdef-1234"), "AB");
  assert.equal(anonymizedInitials("--xy"), "XY");
});

test("anonymizedInitials never throws on an id with no alphanumeric characters", () => {
  assert.equal(anonymizedInitials("---"), "??");
  assert.equal(anonymizedInitials(""), "??");
});

test("rankFromHigherCount converts a 'how many people have more XP' count into a 1-based rank", () => {
  assert.equal(rankFromHigherCount(0), 1);
  assert.equal(rankFromHigherCount(41), 42);
});
