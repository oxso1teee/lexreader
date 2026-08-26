import test from "node:test";
import assert from "node:assert/strict";

await import("./word-tap-core.js");
const {
  normalizeLangCode,
  normalizePageLang,
  langMismatchWarning,
  isSingleWord,
  extractContextSentence,
  buildTranslateRequestBody,
  describeApiError,
  MAX_CONTEXT_LENGTH,
} = globalThis.LexReaderWordTapCore;

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице". Чистая логика word-tap-core.js — та же
// граница тестируемости, что и у youtube-dom-extractor.js
// (dom-transcript.test.mjs): никакого document/chrome, только текст на входе.

test("normalizeLangCode(): extracts the primary subtag, lowercased", () => {
  assert.equal(normalizeLangCode("en-US"), "en");
  assert.equal(normalizeLangCode("EN"), "en");
  assert.equal(normalizeLangCode("pt-BR"), "pt");
  assert.equal(normalizeLangCode("zh_Hans"), "zh");
});

test("normalizeLangCode(): rejects empty/too-short/non-string input", () => {
  assert.equal(normalizeLangCode(""), null);
  assert.equal(normalizeLangCode("  "), null);
  assert.equal(normalizeLangCode("x"), null);
  assert.equal(normalizeLangCode(null), null);
  assert.equal(normalizeLangCode(undefined), null);
});

test("normalizePageLang(): same normalization as normalizeLangCode (document.documentElement.lang input)", () => {
  assert.equal(normalizePageLang("en-GB"), "en");
  assert.equal(normalizePageLang(""), null);
});

test("langMismatchWarning(): null when page and target language agree", () => {
  assert.equal(langMismatchWarning("en", "en"), null);
  assert.equal(langMismatchWarning("en-US", "en-GB"), null, "same primary subtag counts as agreement");
});

test("langMismatchWarning(): null (permissive) when the page never declared a language", () => {
  assert.equal(langMismatchWarning(null, "en"), null);
  assert.equal(langMismatchWarning("", "en"), null);
});

test("langMismatchWarning(): a real, non-blocking string when page and target genuinely differ", () => {
  const warning = langMismatchWarning("ru", "en");
  assert.equal(typeof warning, "string");
  assert.match(warning, /ru/);
  assert.match(warning, /en/);
});

test("isSingleWord(): accepts a plain word", () => {
  assert.equal(isSingleWord("ephemeral"), true);
  assert.equal(isSingleWord("  ephemeral  "), true, "surrounding whitespace is trimmed before validating");
});

test("isSingleWord(): accepts words with apostrophes/hyphens (don't, well-known)", () => {
  assert.equal(isSingleWord("don't"), true);
  assert.equal(isSingleWord("well-known"), true);
});

test("isSingleWord(): rejects a phrase (multiple words) — same scope limit as the backend route", () => {
  assert.equal(isSingleWord("good morning"), false);
  assert.equal(isSingleWord("a b"), false);
});

test("isSingleWord(): rejects empty, punctuation-only, and number-only selections", () => {
  assert.equal(isSingleWord(""), false);
  assert.equal(isSingleWord("   "), false);
  assert.equal(isSingleWord("..."), false);
  assert.equal(isSingleWord("42"), false);
  assert.equal(isSingleWord(null), false);
});

test("isSingleWord(): rejects an unreasonably long selection", () => {
  assert.equal(isSingleWord("a".repeat(41)), false);
  assert.equal(isSingleWord("a".repeat(40)), true);
});

test("extractContextSentence(): returns the sentence containing the word, not the whole block", () => {
  const block = "First sentence here. The ephemeral beauty of cherry blossoms amazes everyone. Third sentence.";
  assert.equal(extractContextSentence(block, "ephemeral"), "The ephemeral beauty of cherry blossoms amazes everyone.");
});

test("extractContextSentence(): case-insensitive match", () => {
  const block = "Some intro. Ephemeral moments fade fast.";
  assert.equal(extractContextSentence(block, "ephemeral"), "Ephemeral moments fade fast.");
});

test("extractContextSentence(): falls back to the whole (normalized) block when no sentence boundary matches", () => {
  const block = "just one run-on block with the word ephemeral in it and no punctuation";
  assert.equal(extractContextSentence(block, "ephemeral"), block);
});

test("extractContextSentence(): collapses internal whitespace/newlines", () => {
  const block = "Weird   \n\n  spacing   here.   Ephemeral  \t stuff  follows.";
  const result = extractContextSentence(block, "ephemeral");
  assert.equal(result, "Ephemeral stuff follows.");
});

test("extractContextSentence(): truncates an overlong match instead of returning it whole", () => {
  const longWord = "ephemeral";
  const block = `${longWord} ${"x".repeat(400)}.`;
  const result = extractContextSentence(block, longWord);
  assert.ok(result.length <= MAX_CONTEXT_LENGTH + 1, "truncated result must respect MAX_CONTEXT_LENGTH");
  assert.ok(result.endsWith("…"));
});

test("extractContextSentence(): empty/blank block yields empty context, never throws", () => {
  assert.equal(extractContextSentence("", "word"), "");
  assert.equal(extractContextSentence("   ", "word"), "");
});

test("buildTranslateRequestBody(): trims word/sentence and passes languages through unchanged", () => {
  const body = buildTranslateRequestBody({ word: "  ephemeral  ", sentence: "  A sentence.  ", sourceLang: "en", targetLang: "ru" });
  assert.deepEqual(body, { word: "ephemeral", sentence: "A sentence.", sourceLang: "en", targetLang: "ru" });
});

test("buildTranslateRequestBody(): empty sentence stays an empty string, not undefined/null", () => {
  const body = buildTranslateRequestBody({ word: "hi", sentence: "", sourceLang: "en", targetLang: "ru" });
  assert.equal(body.sentence, "");
});

test("describeApiError(): maps every status code api/extension/translate-and-save can return to a Russian message", () => {
  assert.match(describeApiError(401), /токен/i);
  assert.match(describeApiError(429), /запрос/i);
  assert.match(describeApiError(402), /лимит/i);
  assert.match(describeApiError(0), /соединени/i);
});

test("describeApiError(): a 400/500 with a server-provided error message passes it through", () => {
  assert.equal(describeApiError(400, { error: "Расширение сохраняет только отдельные слова." }), "Расширение сохраняет только отдельные слова.");
});

test("describeApiError(): unknown status without a body message falls back to a generic message", () => {
  assert.match(describeApiError(500, {}), /не удалось/i);
  assert.match(describeApiError(500, null), /не удалось/i);
});
