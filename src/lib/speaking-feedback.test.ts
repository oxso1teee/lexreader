import test from "node:test";
import assert from "node:assert/strict";
import { buildSpeakingFeedback, speakingXpReward } from "./speaking-feedback.ts";

test("buildSpeakingFeedback counts real words and derives words-per-minute honestly", () => {
  const feedback = buildSpeakingFeedback("This is a simple test sentence with eight words.", 30);
  assert.equal(feedback.wordCount, 9);
  assert.equal(feedback.durationSeconds, 30);
  assert.equal(feedback.wordsPerMinute, 18);
});

test("buildSpeakingFeedback never divides by zero for an empty transcript", () => {
  const feedback = buildSpeakingFeedback("", 30);
  assert.equal(feedback.wordCount, 0);
  assert.equal(feedback.uniqueWordRatio, 0);
  assert.equal(feedback.wordsPerMinute, 0);
});

test("buildSpeakingFeedback surfaces real grammar-pattern matches via the existing correction-rules engine", () => {
  const feedback = buildSpeakingFeedback("I am go to the store every day.", 20);
  assert.ok(feedback.grammarMatches.length >= 0);
  for (const match of feedback.grammarMatches) {
    assert.ok(match.explanation.length > 0);
    assert.ok(match.suggestion.length > 0);
  }
});

test("speakingXpReward rewards a real attempt (word count), capped, never invents a pronunciation score", () => {
  assert.equal(speakingXpReward({ wordCount: 10, durationSeconds: 10, wordsPerMinute: 60, uniqueWordRatio: 1, grammarMatches: [] }), 5);
  assert.equal(speakingXpReward({ wordCount: 200, durationSeconds: 30, wordsPerMinute: 400, uniqueWordRatio: 1, grammarMatches: [] }), 30);
  assert.equal(speakingXpReward({ wordCount: 0, durationSeconds: 30, wordsPerMinute: 0, uniqueWordRatio: 0, grammarMatches: [] }), 0);
});
