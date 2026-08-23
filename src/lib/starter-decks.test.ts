import { test } from "node:test";
import assert from "node:assert/strict";
import { STARTER_DECKS, type StarterLevel } from "./starter-decks.ts";
import { NGSL_WORDS } from "./ngsl-data.ts";

const LEVELS: StarterLevel[] = ["A1", "A2", "B1", "B2"];

test("NGSL_WORDS: real dataset, not a placeholder", () => {
  assert.equal(NGSL_WORDS.length, 2809);
  assert.equal(NGSL_WORDS[0], "the");
  // Every entry lowercase alphabetic (real lemmas, no stray punctuation/casing from the source CSV).
  for (const w of NGSL_WORDS) {
    assert.match(w, /^[a-z]+$/, `unexpected token in NGSL_WORDS: ${JSON.stringify(w)}`);
  }
});

test("STARTER_DECKS: every level has exactly 60 words, all real NGSL words, no duplicates", () => {
  const ngslSet = new Set(NGSL_WORDS);
  for (const level of LEVELS) {
    const def = STARTER_DECKS[level];
    assert.equal(def.words.length, 60, `${level} should have 60 words`);
    assert.equal(new Set(def.words).size, 60, `${level} has a duplicate word`);
    for (const w of def.words) {
      assert.ok(ngslSet.has(w), `${level} word "${w}" is not in NGSL_WORDS — not real data`);
    }
  }
});

test("STARTER_DECKS: no function/grammatical words leaked through the filter", () => {
  const mustNotAppear = ["the", "a", "an", "is", "are", "was", "do", "does", "and", "of", "to", "in", "on", "it", "you", "i"];
  for (const level of LEVELS) {
    for (const banned of mustNotAppear) {
      assert.ok(!STARTER_DECKS[level].words.includes(banned), `${level} leaked function word "${banned}"`);
    }
  }
});

test("STARTER_DECKS: word difficulty increases with level (spot-check via NGSL rank)", () => {
  // Sanity check that the rank-band split actually produces increasingly rarer
  // words per level, not the same/reversed data — average NGSL rank of each
  // level's words should climb monotonically A1 < A2 < B1 < B2.
  const rankOf = new Map(NGSL_WORDS.map((w, i) => [w, i + 1]));
  const avgRank = (level: StarterLevel) => {
    const words = STARTER_DECKS[level].words;
    const sum = words.reduce((s, w) => s + (rankOf.get(w) ?? 0), 0);
    return sum / words.length;
  };
  const a1 = avgRank("A1");
  const a2 = avgRank("A2");
  const b1 = avgRank("B1");
  const b2 = avgRank("B2");
  assert.ok(a1 < a2, `A1 avg rank (${a1}) should be lower than A2 (${a2})`);
  assert.ok(a2 < b1, `A2 avg rank (${a2}) should be lower than B1 (${b1})`);
  assert.ok(b1 < b2, `B1 avg rank (${b1}) should be lower than B2 (${b2})`);
});

test("STARTER_DECKS: across all 4 levels, no word repeats (non-overlapping rank bands)", () => {
  const all = LEVELS.flatMap((l) => STARTER_DECKS[l].words);
  assert.equal(new Set(all).size, all.length, "same word appears in more than one level's deck");
});
