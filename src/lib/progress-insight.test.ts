import assert from "node:assert/strict";
import test from "node:test";
import { decideProgressInsight, type ProgressInsightInput } from "./progress-insight.ts";

const BASE: ProgressInsightInput = {
  dueReviewsCount: 0,
  totalWordsEver: 0,
  hasEverRead: false,
  daysSinceLastReading: null,
  weeklyQuestProgress: 0,
  weeklyQuestTarget: 20,
  wordsAddedThisWeek: 0,
  reviewsThisWeek: 0,
};

test("brand-new account (no words, never read) -> new_user, beats everything else", () => {
  const insight = decideProgressInsight({ ...BASE, dueReviewsCount: 5 });
  assert.equal(insight.key, "new_user");
  assert.equal(insight.ctaHref, "/library");
});

test("due reviews present -> due_reviews, beats weekly goal and reading gap", () => {
  const insight = decideProgressInsight({
    ...BASE,
    totalWordsEver: 10,
    hasEverRead: true,
    dueReviewsCount: 3,
    weeklyQuestProgress: 20,
    daysSinceLastReading: 30,
  });
  assert.equal(insight.key, "due_reviews");
  assert.match(insight.message, /3/);
  assert.equal(insight.ctaHref, "/brain/all/review");
});

test("weekly goal met (no due reviews) -> weekly_goal_met", () => {
  const insight = decideProgressInsight({
    ...BASE,
    totalWordsEver: 20,
    hasEverRead: true,
    weeklyQuestProgress: 25,
    weeklyQuestTarget: 20,
  });
  assert.equal(insight.key, "weekly_goal_met");
});

test("long reading gap (no due reviews, goal not met) -> reading_gap", () => {
  const insight = decideProgressInsight({
    ...BASE,
    totalWordsEver: 10,
    hasEverRead: true,
    daysSinceLastReading: 10,
  });
  assert.equal(insight.key, "reading_gap");
  assert.match(insight.message, /10/);
});

test("reading gap under threshold does not trigger reading_gap", () => {
  const insight = decideProgressInsight({
    ...BASE,
    totalWordsEver: 10,
    hasEverRead: true,
    daysSinceLastReading: 3,
  });
  assert.notEqual(insight.key, "reading_gap");
});

test("many words added this week but zero reviews -> words_without_reviews", () => {
  const insight = decideProgressInsight({
    ...BASE,
    totalWordsEver: 15,
    hasEverRead: true,
    daysSinceLastReading: 1,
    wordsAddedThisWeek: 12,
    reviewsThisWeek: 0,
  });
  assert.equal(insight.key, "words_without_reviews");
});

test("words added this week but some reviews already happened -> falls through to steady", () => {
  const insight = decideProgressInsight({
    ...BASE,
    totalWordsEver: 15,
    hasEverRead: true,
    daysSinceLastReading: 1,
    wordsAddedThisWeek: 12,
    reviewsThisWeek: 2,
  });
  assert.equal(insight.key, "steady");
});

test("nothing notable -> steady, no CTA (not a call to action, just reassurance)", () => {
  const insight = decideProgressInsight({
    ...BASE,
    totalWordsEver: 15,
    hasEverRead: true,
    daysSinceLastReading: 1,
  });
  assert.equal(insight.key, "steady");
  assert.equal(insight.ctaHref, undefined);
});

test("Russian pluralization: 1/2/5 карточек and 1/2/5 дней forms", () => {
  const one = decideProgressInsight({ ...BASE, totalWordsEver: 1, hasEverRead: true, dueReviewsCount: 1 });
  assert.match(one.message, /1 карточка /);
  const few = decideProgressInsight({ ...BASE, totalWordsEver: 1, hasEverRead: true, dueReviewsCount: 3 });
  assert.match(few.message, /3 карточки /);
  const many = decideProgressInsight({ ...BASE, totalWordsEver: 1, hasEverRead: true, dueReviewsCount: 11 });
  assert.match(many.message, /11 карточек /);

  const oneDay = decideProgressInsight({ ...BASE, totalWordsEver: 1, hasEverRead: true, daysSinceLastReading: 21 });
  assert.match(oneDay.message, /21 день /);
});
