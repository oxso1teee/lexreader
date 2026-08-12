import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSentence } from "./correction-rules.ts";

test("checkSentence: catches a known preposition error", () => {
  const result = checkSentence("It depends of the weather.");
  assert.equal(result.supported, true);
  assert.ok(result.matches.some((m) => m.patternKey === "prep_depend_of"));
});

test("checkSentence: catches multiple independent errors in one sentence", () => {
  const result = checkSentence("It depends of the weather and he is married with a doctor.");
  const keys = result.matches.map((m) => m.patternKey);
  assert.ok(keys.includes("prep_depend_of"));
  assert.ok(keys.includes("prep_married_with"));
});

test("checkSentence: a clean sentence is supported with zero matches", () => {
  const result = checkSentence("I read a book yesterday and enjoyed it.");
  assert.equal(result.supported, true);
  assert.equal(result.matches.length, 0);
});

test("checkSentence: empty input is unsupported, not a clean result", () => {
  const result = checkSentence("   ");
  assert.equal(result.supported, false);
  assert.equal(result.matches.length, 0);
});

test("checkSentence: overly long input is unsupported", () => {
  const result = checkSentence("word ".repeat(200));
  assert.equal(result.supported, false);
});

test("checkSentence: non-Latin input is unsupported", () => {
  const result = checkSentence("привет как дела");
  assert.equal(result.supported, false);
});

test("checkSentence: article heuristic is always low confidence", () => {
  const result = checkSentence("I read book yesterday.");
  const articleMatch = result.matches.find((m) => m.category === "article");
  assert.ok(articleMatch);
  assert.equal(articleMatch?.confidence, "low");
});

test("checkSentence: possession heuristic fires on literal-translation pattern", () => {
  const result = checkSentence("This is the car of my friend.");
  assert.ok(result.matches.some((m) => m.category === "possession"));
});

// Incident 2026-08-07: "I cleaning my room" returned zero matches ("Известных
// паттернов не найдено"), which read as "this sentence was checked and is
// fine" for a textbook missing-auxiliary error. These lock in the fix.
test("checkSentence: missing auxiliary in Present Continuous — the reported case", () => {
  const result = checkSentence("I cleaning my room");
  const match = result.matches.find((m) => m.patternKey === "aux_missing_present_continuous");
  assert.ok(match, "expected aux_missing_present_continuous to fire");
  assert.equal(match?.category, "tense");
  assert.equal(match?.confidence, "high");
  assert.match(match!.explanation, /\bbe\b/i);
  assert.equal(match?.suggestion, "I am cleaning");
});

test("checkSentence: missing auxiliary detected across pronouns", () => {
  const cases: [string, string][] = [
    ["He working now.", "He is working"],
    ["They playing football.", "They are playing"],
    ["She studying English.", "She is studying"],
  ];
  for (const [input, expectedSuggestion] of cases) {
    const result = checkSentence(input);
    const match = result.matches.find((m) => m.patternKey === "aux_missing_present_continuous");
    assert.ok(match, `expected a match for: ${input}`);
    assert.equal(match?.suggestion, expectedSuggestion);
  }
});

test("checkSentence: missing-auxiliary rule does not false-positive on correct sentences", () => {
  const cleanSentences = [
    "I am cleaning my room.",
    "He is working now.",
    "They are playing football.",
    "She is studying English.",
    "I enjoy cleaning my room.",
    "I'm cleaning my room.",
  ];
  for (const sentence of cleanSentences) {
    const result = checkSentence(sentence);
    assert.equal(
      result.matches.some((m) => m.patternKey === "aux_missing_present_continuous"),
      false,
      `unexpected match for: ${sentence}`,
    );
  }
});

test("checkSentence: be-agreement mismatch is caught with the correct form", () => {
  assert.equal(
    checkSentence("He are working today.").matches.find((m) => m.patternKey === "be_agreement_mismatch")?.suggestion,
    "He is",
  );
  assert.equal(
    checkSentence("I is happy.").matches.find((m) => m.patternKey === "be_agreement_mismatch")?.suggestion,
    "I am",
  );
  assert.equal(
    checkSentence("They is late.").matches.find((m) => m.patternKey === "be_agreement_mismatch")?.suggestion,
    "They are",
  );
});

test("checkSentence: be-agreement rule does not false-positive on correct sentences", () => {
  for (const sentence of ["He is working.", "I am happy.", "They are late.", "We are here."]) {
    const result = checkSentence(sentence);
    assert.equal(result.matches.some((m) => m.patternKey === "be_agreement_mismatch"), false, sentence);
  }
});

test("checkSentence: fronted always/never word-order error", () => {
  const result = checkSentence("Always I go to school by bus.");
  const match = result.matches.find((m) => m.patternKey === "word_order_fronted_adverb");
  assert.ok(match);
  assert.equal(match?.category, "word_order");
});

test("checkSentence: fronted-adverb rule does not flag grammatical sentence-initial adverbs", () => {
  for (const sentence of ["Sometimes I wonder why.", "Usually I go by bus.", "Always be kind to others."]) {
    const result = checkSentence(sentence);
    assert.equal(result.matches.some((m) => m.patternKey === "word_order_fronted_adverb"), false, sentence);
  }
});

test("checkSentence: malformed passive (Past Simple instead of Past Participle)", () => {
  const result = checkSentence("The book was wrote by him.");
  const match = result.matches.find((m) => m.patternKey === "passive_wrong_participle");
  assert.ok(match);
  assert.equal(match?.category, "passive");
  assert.equal(match?.suggestion, "was written");
});

test("checkSentence: correct passive is not flagged", () => {
  const result = checkSentence("The book was written by him.");
  assert.equal(result.matches.some((m) => m.patternKey === "passive_wrong_participle"), false);
});

test("checkSentence: gerund/infinitive verb-choice errors in both directions", () => {
  const wantsGerund = checkSentence("I want going home.").matches.find(
    (m) => m.patternKey === "infinitive_verb_used_with_gerund",
  );
  assert.equal(wantsGerund?.suggestion, "want to go");

  const wantsInfinitive = checkSentence("I enjoy to read books.").matches.find(
    (m) => m.patternKey === "gerund_verb_used_with_infinitive",
  );
  assert.equal(wantsInfinitive?.suggestion, "enjoy reading");
});

test("checkSentence: gerund/infinitive rule does not false-positive on correct usage", () => {
  for (const sentence of ["I want to go home.", "I enjoy reading books."]) {
    const result = checkSentence(sentence);
    assert.equal(
      result.matches.some((m) => m.category === "gerund_infinitive"),
      false,
      sentence,
    );
  }
});

test("checkSentence: possessive missing apostrophe-s", () => {
  const result = checkSentence("This is my friend car.");
  const match = result.matches.find((m) => m.patternKey === "possession_missing_apostrophe_s");
  assert.ok(match);
  assert.equal(match?.suggestion, "my friend's car");
});

test("checkSentence: possessive rule does not flag a correctly formed possessive", () => {
  const result = checkSentence("This is my friend's car.");
  assert.equal(result.matches.some((m) => m.patternKey === "possession_missing_apostrophe_s"), false);
});

test("checkSentence: edit-distance spelling catches a one-letter-off typo", () => {
  const result = checkSentence("This is a buisness plan.");
  const match = result.matches.find((m) => m.patternKey === "spelling_edit_distance_business");
  assert.ok(match);
  assert.equal(match?.confidence, "medium");
  assert.equal(match?.suggestion, "business");
});

test("checkSentence: edit-distance spelling does not flag correctly spelled words", () => {
  const result = checkSentence("This is a business plan for tomorrow.");
  assert.equal(result.matches.some((m) => m.category === "spelling"), false);
});

test("checkSentence: an unsupported error type still returns supported=true with zero matches", () => {
  // Deliberately not covered by any rule above — the engine must not imply
  // a full grammar check happened, but it also must not crash or mark the
  // input as unsupported (that's reserved for empty/too-long/non-Latin).
  const result = checkSentence("Me no like this thing very much yesterday tomorrow.");
  assert.equal(result.supported, true);
});

// M3 Slice 8 (Learning Paths v1) additions below — three new categories
// (modal, comparative, relative_clause) get honest correction-input
// detection; conditional/question_formation deliberately do not (plan doc §4).

test("checkSentence: modal + 'to' error", () => {
  const result = checkSentence("You must to see a doctor.");
  const match = result.matches.find((m) => m.patternKey === "modal_plus_to");
  assert.ok(match);
  assert.equal(match?.category, "modal");
  assert.equal(match?.confidence, "high");
  assert.equal(match?.suggestion, "must see");
});

test("checkSentence: modal rule does not false-positive on correct modal usage", () => {
  const result = checkSentence("You must see a doctor.");
  assert.equal(result.matches.some((m) => m.patternKey === "modal_plus_to"), false);
});

test("checkSentence: double comparative error", () => {
  const result = checkSentence("This car is more faster than mine.");
  const match = result.matches.find((m) => m.patternKey === "double_comparative");
  assert.ok(match);
  assert.equal(match?.category, "comparative");
  assert.equal(match?.suggestion, "faster");
});

test("checkSentence: comparative rule does not false-positive on a plain comparative", () => {
  const result = checkSentence("This car is faster than mine.");
  assert.equal(result.matches.some((m) => m.patternKey === "double_comparative"), false);
});

test("checkSentence: 'which' used for a person", () => {
  const result = checkSentence("The teacher which helped me is very kind.");
  const match = result.matches.find((m) => m.patternKey === "relative_which_for_person");
  assert.ok(match);
  assert.equal(match?.category, "relative_clause");
  assert.equal(match?.confidence, "medium");
  assert.equal(match?.suggestion, "the teacher who");
});

test("checkSentence: relative-clause rule does not false-positive on 'which' for a thing", () => {
  const result = checkSentence("The book which I bought is great.");
  assert.equal(result.matches.some((m) => m.patternKey === "relative_which_for_person"), false);
});
