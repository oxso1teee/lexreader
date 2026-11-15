import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseFormCandidates, createFormIndex, normalizeForm } from "./lemma.ts";

describe("baseFormCandidates", () => {
  it("regular verb forms", () => {
    assert.ok(baseFormCandidates("walked").includes("walk"));
    assert.ok(baseFormCandidates("walking").includes("walk"));
    assert.ok(baseFormCandidates("walks").includes("walk"));
    assert.ok(baseFormCandidates("liked").includes("like"));
    assert.ok(baseFormCandidates("making").includes("make"));
    assert.ok(baseFormCandidates("stopped").includes("stop"));
    assert.ok(baseFormCandidates("running").includes("run"));
  });

  it("nouns and adjectives", () => {
    assert.ok(baseFormCandidates("cities").includes("city"));
    assert.ok(baseFormCandidates("studied").includes("study"));
    assert.ok(baseFormCandidates("boxes").includes("box"));
    assert.ok(baseFormCandidates("happier").includes("happy"));
    assert.ok(baseFormCandidates("faster").includes("fast"));
    assert.ok(baseFormCandidates("quickly").includes("quick"));
  });

  it("irregular forms resolve to exactly the base", () => {
    assert.deepEqual(baseFormCandidates("went"), ["go"]);
    assert.deepEqual(baseFormCandidates("Was"), ["be"]);
    assert.deepEqual(baseFormCandidates("children"), ["child"]);
    assert.deepEqual(baseFormCandidates("taken"), ["take"]);
  });

  it("never returns the word itself and leaves non-plurals alone", () => {
    assert.ok(!baseFormCandidates("walked").includes("walked"));
    assert.deepEqual(baseFormCandidates("news"), []);
    assert.deepEqual(baseFormCandidates("class"), []);
    assert.deepEqual(baseFormCandidates("bus"), []);
    assert.deepEqual(baseFormCandidates("this"), []);
  });

  it("is empty for short words, non-letters and other languages", () => {
    assert.deepEqual(baseFormCandidates("is"), []);
    assert.deepEqual(baseFormCandidates("don't"), []);
    assert.deepEqual(baseFormCandidates("well-known"), []);
    assert.deepEqual(baseFormCandidates("ходил", "ru"), []);
    assert.deepEqual(baseFormCandidates("walked", "de"), []);
  });
});

describe("normalizeForm", () => {
  it("lowercases and straightens apostrophes", () => {
    assert.equal(normalizeForm("Don’t"), "don't");
  });
});

describe("createFormIndex", () => {
  const entries = { walk: { id: "a" }, went: { id: "b" }, studies: { id: "c" }, cat: { id: "d" } };
  const index = createFormIndex(entries);

  it("exact match wins", () => {
    assert.equal(index.find("walk")?.value.id, "a");
    assert.equal(index.find("WALK")?.value.id, "a");
  });

  it("inflected token resolves to the saved base", () => {
    assert.equal(index.find("walked")?.key, "walk");
    assert.equal(index.find("walking")?.value.id, "a");
    assert.equal(index.find("cats")?.value.id, "d");
    assert.equal(index.find("gone")?.key, "went");
  });

  it("base token resolves to a saved inflected form", () => {
    assert.equal(index.find("study")?.key, "studies");
    assert.equal(index.find("go")?.key, "went");
  });

  it("an exact entry is never shadowed by a derived one", () => {
    const idx = createFormIndex({ walk: { id: "base" }, walked: { id: "past" } });
    assert.equal(idx.find("walked")?.value.id, "past");
    assert.equal(idx.find("walk")?.value.id, "base");
    assert.equal(idx.find("walking")?.value.id, "base");
  });

  it("returns null for unrelated words and for other languages' forms", () => {
    assert.equal(index.find("table"), null);
    const ru = createFormIndex({ ходить: { id: "x" } }, "ru");
    assert.equal(ru.find("ходил"), null);
    assert.equal(ru.find("ходить")?.value.id, "x");
  });
});
