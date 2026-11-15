import assert from "node:assert/strict";
import test from "node:test";
import { splitAtGap } from "./prompt-gap.ts";
import { getPlacementQuestions } from "./question-bank.ts";

test("splitAtGap(): пропуск в середине, в начале и в конце предложения", () => {
  assert.deepEqual(splitAtGap("I saw ___ dog in the park."), { before: "I saw ", after: " dog in the park." });
  assert.deepEqual(splitAtGap("___ you speak English?"), { before: "", after: " you speak English?" });
  assert.deepEqual(splitAtGap("She works at ___"), { before: "She works at ", after: "" });
});

test("splitAtGap(): длина подчёркиваний не важна, но нужно минимум два", () => {
  assert.deepEqual(splitAtGap("It is __ late."), { before: "It is ", after: " late." });
  assert.deepEqual(splitAtGap("It is _______ late."), { before: "It is ", after: " late." });
  assert.equal(splitAtGap("snake_case_word"), null);
});

test("splitAtGap(): инструкция без пропуска → null", () => {
  assert.equal(splitAtGap("Выбери верный порядок слов:"), null);
  assert.equal(splitAtGap(""), null);
});

test("splitAtGap(): делит только по первому пропуску", () => {
  assert.deepEqual(splitAtGap("A ___ and B ___ end"), { before: "A ", after: " and B ___ end" });
});

test("splitAtGap(): реальные вопросы теста — либо ровно один пропуск, либо инструкция без него", () => {
  const questions = getPlacementQuestions();
  assert.ok(questions.length > 0);
  let gaps = 0;
  for (const q of questions) {
    const gap = splitAtGap(q.prompt);
    if (!gap) continue;
    gaps += 1;
    assert.doesNotMatch(gap.before + gap.after, /_{2,}/, q.prompt);
  }
  assert.ok(gaps > 0, "в тесте есть предложения с пропуском");
});
