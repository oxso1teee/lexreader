import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickNextDuelWord,
  pickDistractorWords,
  buildDuelRoundContent,
  describeDuelError,
  DUEL_ROUND_TIME_LIMIT_MS,
  DUEL_OPTION_COUNT,
} from "./duel.ts";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// чистая логика (без БД/RPC) — выбор слов/дистракторов/перемешивание,
// тестируется напрямую.

const POOL = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"] as const;

test("pickNextDuelWord(): returns a word from the pool that isn't already used", () => {
  const used = new Set(["alpha", "bravo", "charlie", "delta", "echo"]);
  const word = pickNextDuelWord(used, POOL);
  assert.equal(word, "foxtrot", "only one word is left unused");
});

test("pickNextDuelWord(): returns null when the whole pool is exhausted", () => {
  const used = new Set(POOL);
  assert.equal(pickNextDuelWord(used, POOL), null);
});

test("pickNextDuelWord(): never returns an already-used word across many draws", () => {
  const used = new Set(["alpha", "bravo"]);
  for (let i = 0; i < 50; i++) {
    const word = pickNextDuelWord(used, POOL);
    assert.ok(word && !used.has(word), `drew an already-used word: ${word}`);
  }
});

test("pickDistractorWords(): returns the requested count, excluding the given set", () => {
  const distractors = pickDistractorWords(new Set(["alpha"]), 3, POOL);
  assert.equal(distractors.length, 3);
  assert.ok(!distractors.includes("alpha"));
  assert.equal(new Set(distractors).size, 3, "no duplicate distractors");
});

test("pickDistractorWords(): caps at the available pool size instead of throwing", () => {
  const distractors = pickDistractorWords(new Set(["alpha", "bravo", "charlie", "delta", "echo"]), 3, POOL);
  assert.equal(distractors.length, 1, "only 'foxtrot' remains available");
});

test("buildDuelRoundContent(): the correct answer is always among the options", () => {
  const content = buildDuelRoundContent("friend", "друг", ["враг", "стол", "окно"]);
  assert.equal(content.word, "friend");
  assert.equal(content.correctAnswer, "друг");
  assert.ok(content.options.includes("друг"));
  assert.equal(content.options.length, 4);
});

test("buildDuelRoundContent(): every distractor is preserved, nothing invented or dropped", () => {
  const distractors = ["враг", "стол", "окно"];
  const content = buildDuelRoundContent("friend", "друг", distractors);
  for (const d of distractors) assert.ok(content.options.includes(d), `missing distractor: ${d}`);
  assert.equal(new Set(content.options).size, DUEL_OPTION_COUNT);
});

test("describeDuelError(): maps every SQL error code this migration can raise to a Russian message", () => {
  const codes = [
    "invalid_round_count",
    "profile_not_found",
    "language_not_supported",
    "duel_not_found",
    "duel_not_active",
    "duel_not_joinable",
    "cannot_join_own_duel",
    "language_mismatch",
    "not_a_participant",
    "already_answered",
    "round_not_found",
    "round_not_timed_out_yet",
    "invalid_options",
    "correct_answer_not_in_options",
  ];
  for (const code of codes) {
    const message = describeDuelError(code);
    assert.notEqual(message, "Что-то пошло не так, попробуй ещё раз.", `${code} fell through to the generic fallback`);
    assert.ok(message.length > 5);
  }
});

test("describeDuelError(): unknown/missing codes fall back to a generic honest message, never crash", () => {
  assert.equal(describeDuelError("some_future_unmapped_code"), "Что-то пошло не так, попробуй ещё раз.");
  assert.equal(describeDuelError(null), "Что-то пошло не так, попробуй ещё раз.");
  assert.equal(describeDuelError(undefined), "Что-то пошло не так, попробуй ещё раз.");
  assert.equal(describeDuelError(""), "Что-то пошло не так, попробуй ещё раз.");
});

test("DUEL_ROUND_TIME_LIMIT_MS mirrors public.duel_round_time_limit_ms() in 0050_vocabulary_duels.sql", () => {
  assert.equal(DUEL_ROUND_TIME_LIMIT_MS, 10_000);
});
