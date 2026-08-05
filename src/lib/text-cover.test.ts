import { test } from "node:test";
import assert from "node:assert/strict";
import { coverGradient, coverInitials, youtubeThumbnailUrl, hashString } from "./text-cover.ts";

test("hashString(): deterministic across calls", () => {
  assert.equal(hashString("A Walk in the Park"), hashString("A Walk in the Park"));
  assert.notEqual(hashString("A Walk in the Park"), hashString("The Long Journey Home"));
});

test("coverGradient(): stable, real colors, not a placeholder rectangle", () => {
  const [a, b] = coverGradient("A Walk in the Park");
  assert.match(a, /^#[0-9a-f]{6}$/i);
  assert.match(b, /^#[0-9a-f]{6}$/i);
  const [a2, b2] = coverGradient("A Walk in the Park");
  assert.equal(a, a2);
  assert.equal(b, b2);
});

test("coverInitials(): first letter of up to two words, uppercased", () => {
  assert.equal(coverInitials("A Walk in the Park"), "AW");
  assert.equal(coverInitials("Coffee"), "C");
  assert.equal(coverInitials("  "), "?");
  assert.equal(coverInitials(""), "?");
});

test("youtubeThumbnailUrl(): free, keyless, deterministic hqdefault URL", () => {
  assert.equal(
    youtubeThumbnailUrl("dQw4w9WgXcQ"),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  );
});
