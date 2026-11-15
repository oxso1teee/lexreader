import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULA, getAllSkills, findSkill } from "../learning-paths/curriculum/index.ts";
import { GRAMMAR_QUESTION_BANK } from "../missions/grammar-bank.ts";
import {
  CHOICE_QUESTION_COUNT,
  SENTENCE_BUILDS_ALONE,
  SENTENCE_BUILDS_WITH_QUESTIONS,
  buildLessonPlan,
  hasCheckMode,
  lessonRequiresExercises,
  toPublicExercise,
  toPublicSteps,
} from "./plan.ts";
import { buildableExamples, choiceExerciseFromQuestion, seededShuffle, sentenceBuildFromExample } from "./exercise-sources.ts";
import { tokenize } from "../lesson-exercises.ts";

const allSkills = Object.values(CURRICULA).flatMap((path) => getAllSkills(path));

test("план строится для каждого навыка каждого пути; id шагов и упражнений уникальны", () => {
  assert.ok(allSkills.length >= 50);
  for (const skill of allSkills) {
    const plan = buildLessonPlan(skill, "lesson");
    assert.ok(plan, skill.key);
    assert.equal(new Set(plan.steps.map((s) => s.id)).size, plan.steps.length, `${skill.key}: step ids`);
    assert.equal(new Set(plan.exerciseOrder).size, plan.exerciseOrder.length, `${skill.key}: exercise ids`);
    for (const step of plan.steps) {
      if (step.kind === "exercise") assert.ok(plan.exercises[step.exerciseId], `${skill.key}: ${step.id}`);
    }
    assert.deepEqual(
      plan.steps.filter((s) => s.kind === "exercise").map((s) => (s.kind === "exercise" ? s.exerciseId : "")),
      plan.exerciseOrder,
    );
  }
});

test("структура урока: введение → материал → (частые ошибки) → упражнения", () => {
  const skill = findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!;
  const plan = buildLessonPlan(skill, "lesson")!;
  assert.deepEqual(
    plan.steps.slice(0, 3).map((s) => s.id),
    ["content:intro", "content:material", "content:mistakes"],
  );
  assert.ok(plan.steps.slice(3).every((s) => s.kind === "exercise"));
});

test("план детерминирован, отпечаток различает режимы и навыки", () => {
  const a = findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!;
  const b = findSkill(CURRICULA["a2-b1"], "grammar.past_simple")!;
  assert.deepEqual(buildLessonPlan(a, "lesson"), buildLessonPlan(a, "lesson"));
  assert.notEqual(buildLessonPlan(a, "lesson")!.signature, buildLessonPlan(a, "check")!.signature);
  assert.notEqual(buildLessonPlan(a, "lesson")!.signature, buildLessonPlan(b, "lesson")!.signature);
});

test("быстрая проверка: только вопросы банка, ровно как раньше (5 вопросов), доступна лишь где банк есть", () => {
  const skill = findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!;
  const plan = buildLessonPlan(skill, "check")!;
  assert.equal(plan.exerciseOrder.length, CHOICE_QUESTION_COUNT);
  assert.ok(plan.steps.every((s) => s.kind === "exercise"));
  assert.ok(Object.values(plan.exercises).every((e) => e.type !== "sentence_build"));
  assert.ok(plan.exerciseOrder.every((id) => GRAMMAR_QUESTION_BANK.some((q) => q.id === id)));

  const topic = findSkill(CURRICULA.everyday, "topic.small_talk")!;
  assert.equal(buildLessonPlan(topic, "check"), null);
  assert.equal(hasCheckMode(topic), false);
  assert.equal(hasCheckMode(skill), true);
});

test("hasCheckMode совпадает с прежним условием «есть вопросы банка у категории навыка»", () => {
  for (const skill of allSkills) {
    const bank = skill.category
      ? GRAMMAR_QUESTION_BANK.some((q) => q.category === skill.category && (!skill.subTopic || q.subTopic === skill.subTopic))
      : false;
    assert.equal(hasCheckMode(skill), bank, skill.key);
  }
});

test("правильные ответы не попадают в клиентский вид упражнений и шагов", () => {
  for (const skill of allSkills) {
    for (const mode of ["lesson", "check"] as const) {
      const plan = buildLessonPlan(skill, mode);
      if (!plan) continue;
      const json = JSON.stringify(toPublicSteps(plan));
      assert.ok(!/correctIndex|solution|explanation|correctAnswer/.test(json), `${skill.key}/${mode}: ${json.slice(0, 120)}`);
      for (const exercise of Object.values(plan.exercises)) {
        const pub = toPublicExercise(exercise) as unknown as Record<string, unknown>;
        assert.ok(!("correctIndex" in pub) && !("solution" in pub) && !("explanation" in pub));
      }
    }
  }
});

test("варианты ответа перемешаны детерминированно, верный ответ остаётся верным", () => {
  for (const question of GRAMMAR_QUESTION_BANK) {
    const a = choiceExerciseFromQuestion(question, "seed");
    const b = choiceExerciseFromQuestion(question, "seed");
    assert.deepEqual(a, b, question.id);
    assert.deepEqual([...a.options].sort(), [...question.options].sort(), question.id);
    assert.equal(a.options[a.correctIndex], question.options[question.correctIndex], question.id);
  }
});

test("перемешивание не оставляет «верный ответ всегда первый»", () => {
  const firstPositions = new Set(
    GRAMMAR_QUESTION_BANK.filter((q) => q.correctIndex === 0).map((q) => choiceExerciseFromQuestion(q, "skill.key").correctIndex),
  );
  assert.ok(firstPositions.size > 1, "правильный ответ должен менять позицию");
});

test("пропуск «___» в вопросе даёт fill_blank, остальное — multiple_choice", () => {
  const blankQ = GRAMMAR_QUESTION_BANK.find((q) => q.prompt.includes("___"))!;
  const plainQ = GRAMMAR_QUESTION_BANK.find((q) => !q.prompt.includes("___"))!;
  assert.equal(choiceExerciseFromQuestion(blankQ, "s").type, "fill_blank");
  assert.equal(choiceExerciseFromQuestion(plainQ, "s").type, "multiple_choice");
});

test("«собери предложение»: берутся только примеры из урока в 3–10 слов, количество ограничено", () => {
  for (const skill of allSkills) {
    const plan = buildLessonPlan(skill, "lesson")!;
    const builds = Object.values(plan.exercises).filter((e) => e.type === "sentence_build");
    const hasQuestions = plan.exerciseOrder.some((id) => GRAMMAR_QUESTION_BANK.some((q) => q.id === id));
    assert.ok(builds.length <= (hasQuestions ? SENTENCE_BUILDS_WITH_QUESTIONS : SENTENCE_BUILDS_ALONE), skill.key);
    for (const exercise of builds) {
      if (exercise.type !== "sentence_build") continue;
      const sentence = exercise.solution.join(" ");
      assert.ok(skill.lesson.examples.some((example) => tokenize(example).join(" ") === sentence), `${skill.key}: «${sentence}» не из примеров урока`);
      assert.ok(exercise.solution.length >= 3 && exercise.solution.length <= 10, skill.key);
      assert.deepEqual([...exercise.tiles].sort(), [...exercise.solution].sort(), skill.key);
    }
  }
});

test("порядок тайлов не совпадает с решением, когда это возможно", () => {
  for (const skill of allSkills) {
    for (const example of buildableExamples(skill.lesson.examples)) {
      const built = sentenceBuildFromExample(example, skill.key, 0)!;
      const distinct = new Set(built.solution).size > 1;
      if (distinct) assert.notEqual(built.tiles.join(" "), built.solution.join(" "), `${skill.key}: ${example}`);
    }
  }
});

test("примеры короче 3 слов отсеиваются, повторы схлопываются, слишком длинные не берутся", () => {
  const eleven = "one two three four five six seven eight nine ten eleven";
  assert.deepEqual(
    buildableExamples(["Hi!", "Thank you.", "How are you?", "how are you", "Nice to meet you.", eleven]),
    ["How are you?", "Nice to meet you."],
  );
  assert.equal(sentenceBuildFromExample("Hello there", "s", 0), null);
});

test("masteryEligible только там, где достаточно вопросов банка", () => {
  const banked = buildLessonPlan(findSkill(CURRICULA["a2-b1"], "grammar.articles")!, "lesson")!;
  const topic = buildLessonPlan(findSkill(CURRICULA.everyday, "topic.small_talk")!, "lesson")!;
  assert.equal(banked.masteryEligible, true);
  assert.equal(topic.masteryEligible, false);
  assert.ok(topic.exerciseOrder.length > 0, "тематический урок получает практику из своих примеров");
});

test("урок без пригодных примеров и без банка — читательский: упражнений нет", () => {
  const plan = buildLessonPlan(findSkill(CURRICULA["a2-b1"], "vocabulary.active_recall")!, "lesson")!;
  assert.equal(plan.exerciseOrder.length, 0);
  assert.ok(plan.steps.length >= 2 && plan.steps.every((s) => s.kind === "content"));
});

test("seededShuffle: детерминирован, не меняет состав, зависит от seed", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(seededShuffle(items, "a"), seededShuffle(items, "a"));
  assert.deepEqual([...seededShuffle(items, "a")].sort(), items);
  assert.notDeepEqual(seededShuffle(items, "a"), seededShuffle(items, "b"));
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8], "исходный массив не мутируется");
});

test("lessonRequiresExercises: уроки с практикой нельзя засчитать вручную, читательские — можно", () => {
  const withBank = findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!;
  const withBuilds = findSkill(CURRICULA.everyday, "topic.small_talk")!;
  const readingOnly = findSkill(CURRICULA["a2-b1"], "vocabulary.active_recall")!;
  assert.equal(lessonRequiresExercises(withBank), true);
  assert.equal(lessonRequiresExercises(withBuilds), true);
  assert.equal(lessonRequiresExercises(readingOnly), false);
  // согласовано с планом: ровно те навыки, у которых план урока содержит упражнения
  for (const skill of allSkills) {
    assert.equal(lessonRequiresExercises(skill), buildLessonPlan(skill, "lesson")!.exerciseOrder.length > 0, skill.key);
  }
});
