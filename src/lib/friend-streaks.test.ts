import { test } from "node:test";
import assert from "node:assert/strict";
import { friendStreakPartner, describeFriendStreakError, type FriendStreakRow } from "./friend-streaks.ts";

// docs/moments/ROADMAP.md, этап 6 — чистая логика без БД, тестируется напрямую.

const ROW: FriendStreakRow = {
  id: "row-1",
  user_a: "user-a",
  user_a_initials: "АБ",
  user_a_personal_streak: 10,
  user_b: "user-b",
  user_b_initials: "ВГ",
  user_b_personal_streak: 4,
  streak: 7,
  last_both_active_day: "2026-10-20",
  invite_token: "token-1",
  accepted_at: "2026-10-01T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
};

test("friendStreakPartner(): returns user_b's data when the caller is user_a", () => {
  const partner = friendStreakPartner(ROW, "user-a");
  assert.deepEqual(partner, { initial: "ВГ", personalStreak: 4 });
});

test("friendStreakPartner(): returns user_a's data when the caller is user_b", () => {
  const partner = friendStreakPartner(ROW, "user-b");
  assert.deepEqual(partner, { initial: "АБ", personalStreak: 10 });
});

test("friendStreakPartner(): falls back to an ellipsis when user_b hasn't accepted yet", () => {
  const pending: FriendStreakRow = { ...ROW, user_b: null, user_b_initials: null, user_b_personal_streak: 0 };
  const partner = friendStreakPartner(pending, "user-a");
  assert.equal(partner.initial, "…");
});

test("describeFriendStreakError(): maps every SQL error code to a Russian message", () => {
  for (const code of ["invite_not_found", "invite_already_used", "cannot_accept_own_invite"]) {
    const message = describeFriendStreakError(code);
    assert.notEqual(message, "Что-то пошло не так, попробуй ещё раз.", `${code} fell through to the generic fallback`);
  }
});

test("describeFriendStreakError(): unknown/missing codes fall back to a generic message, never crash", () => {
  assert.equal(describeFriendStreakError("some_future_code"), "Что-то пошло не так, попробуй ещё раз.");
  assert.equal(describeFriendStreakError(null), "Что-то пошло не так, попробуй ещё раз.");
});
