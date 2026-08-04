import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFilter, matchesSearch, typeLabel, materialsCountLabel, type LibraryItem } from "./library-item.ts";

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "t1",
    kind: "text",
    title: "A Walk in the Park",
    href: "/read/t1",
    language: "en",
    levelTag: "a2",
    youtubeVideoId: null,
    isSystem: false,
    canDelete: true,
    percentRead: 40,
    lastReadAt: "2026-08-01T00:00:00.000Z",
    savedWordsCount: 3,
    savedPhrasesCount: 1,
    partCount: null,
    ...overrides,
  };
}

test("matchesFilter(): all always matches", () => {
  assert.equal(matchesFilter(item(), "all"), true);
  assert.equal(matchesFilter(item({ percentRead: 0 }), "all"), true);
});

test("matchesFilter(): video requires a youtube id on a text item", () => {
  assert.equal(matchesFilter(item({ youtubeVideoId: "abc123" }), "video"), true);
  assert.equal(matchesFilter(item({ youtubeVideoId: null }), "video"), false);
  assert.equal(matchesFilter(item({ kind: "collection", youtubeVideoId: null }), "video"), false);
});

test("matchesFilter(): text excludes youtube materials and collections", () => {
  assert.equal(matchesFilter(item({ youtubeVideoId: null }), "text"), true);
  assert.equal(matchesFilter(item({ youtubeVideoId: "abc" }), "text"), false);
  assert.equal(matchesFilter(item({ kind: "collection" }), "text"), false);
});

test("matchesFilter(): collection only matches kind=collection", () => {
  assert.equal(matchesFilter(item({ kind: "collection" }), "collection"), true);
  assert.equal(matchesFilter(item({ kind: "text" }), "collection"), false);
});

test("matchesFilter(): completed uses real percentRead >= 100, not a mock flag", () => {
  assert.equal(matchesFilter(item({ percentRead: 100 }), "completed"), true);
  assert.equal(matchesFilter(item({ percentRead: 99 }), "completed"), false);
  assert.equal(matchesFilter(item({ percentRead: 0 }), "completed"), false);
});

test("matchesSearch(): empty query matches everything", () => {
  assert.equal(matchesSearch(item(), ""), true);
  assert.equal(matchesSearch(item(), "   "), true);
});

test("matchesSearch(): matches title case-insensitively", () => {
  assert.equal(matchesSearch(item({ title: "A Walk in the Park" }), "walk"), true);
  assert.equal(matchesSearch(item({ title: "A Walk in the Park" }), "WALK"), true);
  assert.equal(matchesSearch(item({ title: "A Walk in the Park" }), "airport"), false);
});

test("matchesSearch(): also matches the type label (e.g. 'видео')", () => {
  assert.equal(matchesSearch(item({ youtubeVideoId: "abc" }), "видео"), true);
  assert.equal(matchesSearch(item({ youtubeVideoId: null }), "видео"), false);
});

test("typeLabel(): collection/video/text mapping", () => {
  assert.equal(typeLabel(item({ kind: "collection" })), "Книга");
  assert.equal(typeLabel(item({ youtubeVideoId: "abc" })), "Видео");
  assert.equal(typeLabel(item({ youtubeVideoId: null })), "Текст");
});

test("materialsCountLabel(): Russian pluralization", () => {
  assert.equal(materialsCountLabel(1), "1 материал");
  assert.equal(materialsCountLabel(2), "2 материала");
  assert.equal(materialsCountLabel(5), "5 материалов");
  assert.equal(materialsCountLabel(11), "11 материалов");
  assert.equal(materialsCountLabel(21), "21 материал");
});
