import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { knownFormIndex } from "../vocabulary/text-familiarity.ts";
import { cefrFromMetrics, estimateTextDifficulty, MIN_SAMPLE_WORDS } from "./difficulty.ts";

const none = knownFormIndex([], "en");

const EASY =
  "I like my school. I go to school every day. My friend and I play in the house. We eat food at home. " +
  "The family is good. I know my book. We work and we play. The day is long. I think we can help. " +
  "They want to see the world. She will come back to the school after the week.";

const HARD_SENTENCE =
  "Notwithstanding considerable epistemological reservations, the commissioners promulgated an inscrutable " +
  "memorandum concerning jurisprudential ramifications of unprecedented legislative circumvention, " +
  "whereupon sceptical parliamentarians vehemently contested the aforementioned apportionment of fiduciary obligations.";
const HARD = `${HARD_SENTENCE} ${HARD_SENTENCE}`;

describe("estimateTextDifficulty", () => {
  it("easy everyday text is A2/B1 with high NGSL coverage and short sentences", () => {
    const d = estimateTextDifficulty(EASY, none);
    assert.ok(d);
    assert.ok(d.ngslCoverage >= 90, `coverage ${d.ngslCoverage}`);
    assert.ok(d.avgSentenceWords <= 12);
    assert.ok(d.cefr === "A2" || d.cefr === "B1");
  });

  it("dense academic text is rated harder than everyday text", () => {
    const easy = estimateTextDifficulty(EASY, none);
    const hard = estimateTextDifficulty(HARD, none);
    assert.ok(easy && hard);
    assert.ok(hard.ngslCoverage < easy.ngslCoverage);
    assert.ok(hard.cefr === "B2" || hard.cefr === "C1");
  });

  it("counts new words with word forms taken into account", () => {
    const all = estimateTextDifficulty(EASY, none);
    const known = knownFormIndex(["school", "play", "see", "friends"], "en");
    const some = estimateTextDifficulty(EASY, known);
    assert.ok(all && some);
    assert.equal(some.uniqueWords, all.uniqueWords);
    assert.ok(some.newWords < all.newWords);
    assert.equal(some.percentNew, Math.round((some.newWords / some.uniqueWords) * 100));
  });

  it("returns null for other languages and for samples that are too short", () => {
    assert.equal(estimateTextDifficulty(EASY, none, "de"), null);
    assert.equal(estimateTextDifficulty("I like it.", none), null);
    const justEnough = Array.from({ length: MIN_SAMPLE_WORDS }, () => "go").join(" ") + ".";
    assert.ok(estimateTextDifficulty(justEnough, none));
  });

  it("ignores proper nouns in the middle of a sentence", () => {
    const names = Array.from({ length: 40 }, () => "I see Zbigniew Brzezinski").join(". ") + ".";
    const d = estimateTextDifficulty(names, none);
    assert.ok(d);
    assert.equal(d.ngslCoverage, 100);
  });

  it("is bounded: only the beginning of a huge text is analysed", () => {
    const huge = (EASY + " ").repeat(2000);
    const started = Date.now();
    const d = estimateTextDifficulty(huge, none);
    assert.ok(d);
    assert.ok(Date.now() - started < 1500);
  });
});

describe("cefrFromMetrics", () => {
  it("is monotonic in both coverage and sentence length", () => {
    assert.equal(cefrFromMetrics(97, 8), "A2");
    assert.equal(cefrFromMetrics(97, 15), "B1");
    assert.equal(cefrFromMetrics(90, 20), "B2");
    assert.equal(cefrFromMetrics(80, 20), "C1");
    assert.equal(cefrFromMetrics(97, 40), "C1");
  });
});
