import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarColor, AVATAR_COLORS } from "./avatar-color.ts";
import { cx } from "./cx.ts";

test("cx drops falsy values and keeps order", () => {
  assert.equal(cx("a", false, null, undefined, "", "b", "c"), "a b c");
  assert.equal(cx(), "");
});

test("avatarColor is deterministic and always one of the palette tokens", () => {
  assert.equal(avatarColor("sergey@example.com"), avatarColor("sergey@example.com"));
  for (const seed of ["", "a", "Аня", "x".repeat(200), "test@example.com"]) {
    assert.ok((AVATAR_COLORS as readonly string[]).includes(avatarColor(seed)));
  }
  // разные зёрна не схлопываются в один цвет
  const used = new Set(Array.from({ length: 60 }, (_, i) => avatarColor(`user-${i}`)));
  assert.ok(used.size >= 3);
});
