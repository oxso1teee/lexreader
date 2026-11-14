import { buildGrammarQuestionSet } from "../missions/grammar-bank.ts";
import type { Skill } from "../learning-paths/types.ts";
import { buildableExamples, choiceExerciseFromQuestion, sentenceBuildFromExample, SHUFFLE_VERSION } from "./exercise-sources.ts";
import type {
  ContentBlock,
  LessonMode,
  LessonPlan,
  LessonStep,
  PublicExercise,
  ServerExercise,
} from "./types.ts";

// План урока — детерминированная функция от навыка (статический курс) и
// режима. Нигде не хранится: БД держит только позицию в плане и ответы, а
// сам план всегда пересобирается из кода, поэтому правка курса не требует
// миграции, а старые попытки распознаются по отпечатку (signature).
//
// Структура (lesson): введение → материал → частые ошибки → упражнения.
// Структура расширяемая: новый вид шага — новая ветка LessonStep, новый тип
// упражнения — запись в реестре validators.ts и источник в exercise-sources.ts.

/** Столько вопросов банка и раньше задавала «Проверка знаний». */
export const CHOICE_QUESTION_COUNT = 5;
/** Сколько упражнений «собери предложение» добавляется к вопросам банка. */
export const SENTENCE_BUILDS_WITH_QUESTIONS = 2;
/** Если вопросов банка нет, практика состоит из «собери предложение». */
export const SENTENCE_BUILDS_ALONE = 3;
/** Минимум вопросов банка, при котором результат влияет на «уверенность». */
export const MASTERY_MIN_QUESTIONS = 3;

const CONTENT_BLOCKS: Record<ContentBlock, string> = {
  intro: "content:intro",
  material: "content:material",
  mistakes: "content:mistakes",
};

function contentStep(block: ContentBlock): LessonStep {
  return { id: CONTENT_BLOCKS[block], kind: "content", block };
}

function exerciseStep(exercise: ServerExercise): LessonStep {
  return { id: `ex:${exercise.id}`, kind: "exercise", exerciseId: exercise.id, exerciseType: exercise.type };
}

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function collectExercises(skill: Skill, mode: LessonMode): { exercises: ServerExercise[]; questionCount: number } {
  const questions = skill.category
    ? buildGrammarQuestionSet(skill.category, CHOICE_QUESTION_COUNT, skill.key, skill.subTopic)
    : [];
  const choices = questions.map((question) => choiceExerciseFromQuestion(question, skill.key));

  // Быстрая проверка — только вопросы банка (как и раньше); builds — только в уроке.
  if (mode === "check") return { exercises: choices, questionCount: choices.length };

  const limit = choices.length > 0 ? SENTENCE_BUILDS_WITH_QUESTIONS : SENTENCE_BUILDS_ALONE;
  const builds = buildableExamples(skill.lesson.examples)
    .slice(0, limit)
    .flatMap((example, index) => {
      const built = sentenceBuildFromExample(example, skill.key, index);
      return built ? [built] : [];
    });
  return { exercises: [...choices, ...builds], questionCount: choices.length };
}

/** План урока или null, если для режима нечего проходить (check без вопросов). */
export function buildLessonPlan(skill: Skill, mode: LessonMode): LessonPlan | null {
  const { exercises, questionCount } = collectExercises(skill, mode);
  if (mode === "check" && exercises.length === 0) return null;

  const steps: LessonStep[] = [];
  if (mode === "lesson") {
    steps.push(contentStep("intro"), contentStep("material"));
    if (skill.lesson.commonMistakes.length > 0) steps.push(contentStep("mistakes"));
  }
  steps.push(...exercises.map(exerciseStep));

  const byId: Record<string, ServerExercise> = {};
  for (const exercise of exercises) byId[exercise.id] = exercise;

  // Отпечаток охватывает всё, к чему привязаны сохранённые ответы: состав шагов и
  // структуру упражнений (порядок вариантов, верный индекс, слова решения).
  // Правка орфографии в тексте вопроса отпечаток не меняет — только то, что могло
  // бы исказить смысл уже записанного ответа.
  const structure = exercises
    .map((exercise) =>
      exercise.type === "sentence_build"
        ? `${exercise.id}:${exercise.solution.join(" ")}:${exercise.tiles.join(" ")}`
        : `${exercise.id}:${exercise.correctIndex}:${exercise.options.join("|")}`,
    )
    .join(";");

  return {
    mode,
    skillKey: skill.key,
    steps,
    exercises: byId,
    exerciseOrder: exercises.map((exercise) => exercise.id),
    signature: hashString(`v${SHUFFLE_VERSION}|${mode}|${skill.key}|${steps.map((step) => step.id).join(",")}|${structure}`),
    masteryEligible: questionCount >= MASTERY_MIN_QUESTIONS,
  };
}

/** В уроке есть упражнения — значит, засчитать его можно только через плеер или
 *  быструю проверку (ответы проверяет сервер), а не одним нажатием «изучено». */
export function lessonRequiresExercises(skill: Skill): boolean {
  const plan = buildLessonPlan(skill, "lesson");
  return plan !== null && plan.exerciseOrder.length > 0;
}

/** Есть ли у навыка быстрая проверка знаний (раньше — hasKnowledgeCheck). */
export function hasCheckMode(skill: Skill): boolean {
  return buildLessonPlan(skill, "check") !== null;
}

/** Упражнение для клиента: без ответа и без объяснения. */
export function toPublicExercise(exercise: ServerExercise): PublicExercise {
  switch (exercise.type) {
    case "multiple_choice":
    case "fill_blank":
      return { id: exercise.id, type: exercise.type, prompt: exercise.prompt, options: [...exercise.options] };
    case "sentence_build":
      return { id: exercise.id, type: exercise.type, instruction: exercise.instruction, tiles: [...exercise.tiles] };
  }
}

export interface PublicStep {
  id: string;
  kind: "content" | "exercise";
  block?: ContentBlock;
  exercise?: PublicExercise;
}

export function toPublicSteps(plan: LessonPlan): PublicStep[] {
  return plan.steps.map((step) =>
    step.kind === "content"
      ? { id: step.id, kind: "content", block: step.block }
      : { id: step.id, kind: "exercise", exercise: toPublicExercise(plan.exercises[step.exerciseId]) },
  );
}
