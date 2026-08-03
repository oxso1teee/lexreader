import assert from "node:assert/strict";
import test from "node:test";
import { avatarInitials } from "./avatar-initials.ts";

test("takes the first two alphanumeric characters of the local part, uppercased", () => {
  assert.equal(avatarInitials("prod-smoke-test-20260802@example.com"), "PR");
  assert.equal(avatarInitials("test@example.com"), "TE");
});

test("skips leading punctuation to find alphanumeric characters", () => {
  assert.equal(avatarInitials("_-a1b2@example.com"), "A1");
});

test("single-character local part still produces something, not empty", () => {
  assert.equal(avatarInitials("a@example.com"), "A");
});

test("empty/malformed input falls back to a placeholder, never throws", () => {
  assert.equal(avatarInitials(""), "?");
  assert.equal(avatarInitials("@example.com"), "?");
  assert.equal(avatarInitials("---@example.com"), "?");
});
