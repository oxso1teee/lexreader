import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cacheLookupKeys, lookupCachedTranslation, normalizeTranslationKey } from "./translation-cache.ts";

describe("normalizeTranslationKey", () => {
  it("lowercases a single word and trims it", () => {
    assert.equal(normalizeTranslationKey("  Walked "), "walked");
    assert.equal(normalizeTranslationKey("WALKED"), "walked");
  });

  it("keeps the case of phrases and sentences but collapses whitespace", () => {
    assert.equal(normalizeTranslationKey("She  walked\n home.  "), "She walked home.");
    assert.equal(normalizeTranslationKey("New York"), "New York");
  });

  it("keeps non-latin words intact apart from case", () => {
    assert.equal(normalizeTranslationKey("Ходил"), "ходил");
  });
});

describe("cacheLookupKeys", () => {
  it("returns one key when the text is already normalized", () => {
    assert.deepEqual(cacheLookupKeys("walked"), ["walked"]);
  });

  it("checks the exact text first, then the normalized key", () => {
    assert.deepEqual(cacheLookupKeys("Walked"), ["Walked", "walked"]);
    assert.deepEqual(cacheLookupKeys("A  b"), ["A  b", "A b"]);
  });
});

describe("lookupCachedTranslation", () => {
  it("finds a legacy row stored under the exact text without querying further", async () => {
    const asked: string[] = [];
    const result = await lookupCachedTranslation("Walked", async (key) => {
      asked.push(key);
      return key === "Walked" ? "ходил (старая запись)" : null;
    });
    assert.equal(result, "ходил (старая запись)");
    assert.deepEqual(asked, ["Walked"]);
  });

  it("falls back to the normalized key", async () => {
    const store = new Map([["walked", "ходил"]]);
    const asked: string[] = [];
    const result = await lookupCachedTranslation("Walked", async (key) => {
      asked.push(key);
      return store.get(key) ?? null;
    });
    assert.equal(result, "ходил");
    assert.deepEqual(asked, ["Walked", "walked"]);
  });

  it("returns null on a miss", async () => {
    assert.equal(await lookupCachedTranslation("zebra", async () => null), null);
  });

  it("does not treat an empty cached string as a miss", async () => {
    assert.equal(await lookupCachedTranslation("x", async () => ""), "");
  });
});
