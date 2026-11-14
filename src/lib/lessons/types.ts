import type { PathSlug } from "../learning-paths/types.ts";

// Phase 2, итерация 5 — уроки и упражнения. Общие типы движка.
//
// Граница доверия проходит прямо по этим типам:
//   ServerExercise — полное упражнение с ответом и объяснением. Живёт только
//                    на сервере, в клиентский бандл и в props не попадает.
//   PublicExercise — то, что видит клиент до ответа (без ответа и объяснения).
//   ExerciseVerdict — результат проверки; уходит клиенту только ПОСЛЕ ответа.

/** lesson — полный урок (материал + упражнения); check — быстрая проверка
 *  знаний (только упражнения, доступна и на закрытом уроке). */
export type LessonMode = "lesson" | "check";

export type ExerciseType = "multiple_choice" | "fill_blank" | "sentence_build";

export type ContentBlock = "intro" | "material" | "mistakes";

export type LessonStep =
  | { id: string; kind: "content"; block: ContentBlock }
  | { id: string; kind: "exercise"; exerciseId: string; exerciseType: ExerciseType };

// ---------- Упражнения (сервер) ----------

interface ChoiceExerciseFields {
  id: string;
  /** Для fill_blank содержит «___» на месте пропуска. */
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MultipleChoiceExercise extends ChoiceExerciseFields {
  type: "multiple_choice";
}

export interface FillBlankExercise extends ChoiceExerciseFields {
  type: "fill_blank";
}

export interface SentenceBuildExercise {
  id: string;
  type: "sentence_build";
  instruction: string;
  /** Тайлы в перемешанном виде — их видит и клиент. */
  tiles: string[];
  /** Верный порядок — только сервер. */
  solution: string[];
  explanation: string;
}

export type ServerExercise = MultipleChoiceExercise | FillBlankExercise | SentenceBuildExercise;

// ---------- Упражнения (клиент) ----------

export interface PublicChoiceExercise {
  id: string;
  type: "multiple_choice" | "fill_blank";
  prompt: string;
  options: string[];
}

export interface PublicSentenceBuildExercise {
  id: string;
  type: "sentence_build";
  instruction: string;
  tiles: string[];
}

export type PublicExercise = PublicChoiceExercise | PublicSentenceBuildExercise;

// ---------- Ответы и проверка ----------

export type ExerciseResponse = { type: "choice"; index: number } | { type: "tiles"; tiles: string[] };

export interface ExerciseVerdict {
  correct: boolean;
  /** Правильный ответ в виде текста для показа после ответа. */
  correctAnswer: string;
  explanation: string;
}

/** Ответ, сохранённый в lesson_attempts.answers. */
export interface StoredAnswer {
  exerciseId: string;
  response: ExerciseResponse;
  correct: boolean;
  at: string;
}

// ---------- План урока ----------

export interface LessonPlan {
  mode: LessonMode;
  skillKey: string;
  steps: LessonStep[];
  exercises: Record<string, ServerExercise>;
  /** Порядок упражнений в плане (id). */
  exerciseOrder: string[];
  /** Отпечаток состава шагов: если контент изменился между деплоями,
   *  сохранённая позиция открытой попытки больше не соответствует плану. */
  signature: string;
  /** Достаточно ли вопросов из банка, чтобы результат менял уверенность в
   *  навыке (confident/practicing). Одно-два упражнения «собери пример» — нет:
   *  правило плана «никакой фальшивой уверенности по одному клику». */
  masteryEligible: boolean;
}

// ---------- Попытка (состояние в БД) ----------

export type AttemptStatus = "in_progress" | "completed" | "abandoned";

export interface AttemptRecord {
  id: string;
  userId: string;
  pathSlug: PathSlug;
  pathVersion: number;
  skillKey: string;
  mode: LessonMode;
  status: AttemptStatus;
  stepIndex: number;
  stepsTotal: number;
  signature: string;
  answers: StoredAnswer[];
  correctCount: number;
  incorrectCount: number;
  passed: boolean | null;
  scoreRatio: number | null;
  xpAwarded: number;
  xpClaimedAt: string | null;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  /** Побочные эффекты завершения (прогресс навыка, XP) применены полностью. */
  finalizedAt: string | null;
}

export interface SkillAddress {
  pathSlug: PathSlug;
  pathVersion: number;
  skillKey: string;
}
