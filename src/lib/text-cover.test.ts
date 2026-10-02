import { test } from "node:test";
import assert from "node:assert/strict";
import { ABSTRACT_MOTIFS, coverGradient, coverMotif, youtubeThumbnailUrl, hashString } from "./text-cover.ts";

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

test("coverMotif(): deterministic per title, one of the 4 abstract motifs", () => {
  const motif = coverMotif("A Walk in the Park", false);
  assert.equal(motif, coverMotif("A Walk in the Park", false));
  assert.ok((ABSTRACT_MOTIFS as readonly string[]).includes(motif));
});

test("coverMotif(): YouTube material always gets the fixed video motif", () => {
  assert.equal(coverMotif("A Walk in the Park", true), "video");
  assert.equal(coverMotif("", true), "video");
});

test("coverMotif(): all 4 abstract motifs reachable, never video for plain text", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(coverMotif(`Text number ${i}`, false));
  assert.deepEqual([...seen].sort(), [...ABSTRACT_MOTIFS].sort());
});

test("coverMotif() is not locked to the gradient: each palette colour meets several motifs", () => {
  const byColour = new Map<string, Set<string>>();
  for (let i = 0; i < 300; i++) {
    const title = `Sample ${i}`;
    const key = coverGradient(title).join();
    if (!byColour.has(key)) byColour.set(key, new Set());
    byColour.get(key)!.add(coverMotif(title, false));
  }
  for (const motifs of byColour.values()) assert.equal(motifs.size, ABSTRACT_MOTIFS.length);
});

test("youtubeThumbnailUrl(): free, keyless, deterministic hqdefault URL", () => {
  assert.equal(
    youtubeThumbnailUrl("dQw4w9WgXcQ"),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  );
});
