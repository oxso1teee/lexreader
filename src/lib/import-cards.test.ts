import assert from "node:assert/strict";
import test from "node:test";
import { parseImportCards } from "./import-cards.ts";

test("parses CSV headers and quoted commas", () => {
  const cards = parseImportCards(
    "cards.csv",
    'phrase,translation,notes\n"Hello, how are you?","Привет, как дела?","Greeting"\n',
  );
  assert.deepEqual(cards, [
    {
      front: "Hello, how are you?",
      back: "Привет, как дела?",
      notes: "Greeting",
    },
  ]);
});

test("detects semicolon CSV and alternative headers", () => {
  const cards = parseImportCards(
    "cards.csv",
    "english;meaning\nGood morning.;Доброе утро.\nGood night.;Спокойной ночи.",
  );
  assert.equal(cards.length, 2);
  assert.equal(cards[1].front, "Good night.");
  assert.equal(cards[1].back, "Спокойной ночи.");
});

test("parses TSV and removes exact duplicates", () => {
  const cards = parseImportCards(
    "cards.tsv",
    "front\tback\nSee you.\tУвидимся.\nSee you.\tУвидимся.",
  );
  assert.equal(cards.length, 1);
});

test("parses JSON wrappers and phrase/translation fields", () => {
  const cards = parseImportCards(
    "cards.json",
    JSON.stringify({
      cards: [{ phrase: "Not now.", translation: "Не сейчас." }],
    }),
  );
  assert.deepEqual(cards, [{ front: "Not now.", back: "Не сейчас.", notes: undefined }]);
});

test("rejects phrase-only JSON before import", () => {
  assert.throws(
    () => parseImportCards("cards.json", '{"phrases":["Good night.","See you later."]}'),
    /нет фразы или перевода/,
  );
});

test("rejects a saved HTML page instead of importing source code", () => {
  assert.throws(
    () => parseImportCards("page.html", "<!DOCTYPE html><html><body>phrase,translation</body></html>"),
    /сохранённая веб-страница HTML/,
  );
});
