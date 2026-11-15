// Чек-лист «Первые шаги» (макет Today-new). Состояние шагов выводится из
// реальных данных, отдельно ничего не хранится: прочитано ли что-нибудь
// (сессии чтения / прогресс по тексту), сколько слов сохранено
// (vocabulary_items) и было ли хоть одно повторение (review_log).
//
// Суммы XP у шагов намеренно не показываем: реальные начисления зависят от
// действия (чтение, слово, карточка, бонусы), и вшитое в подпись число
// разошлось бы с ними при первой же правке.
export const FIRST_STEPS_WORD_TARGET = 5;
/** Чек-лист нужен только в первые дни: окна «за 7 дней» на главной тогда покрывают всю историю. */
export const FIRST_STEPS_MAX_ACCOUNT_AGE_DAYS = 7;

export type FirstStepKey = "read" | "save-words" | "review";
export type FirstStepStatus = "done" | "current" | "upcoming";

export interface FirstStep {
  key: FirstStepKey;
  title: string;
  hint: string;
  status: FirstStepStatus;
  /** Куда вести; null — шаг выполнен или пока недоступен. */
  href: string | null;
}

export interface FirstStepsInput {
  hasRead: boolean;
  savedWords: number;
  hasReviewed: boolean;
  dueCount: number;
}

export interface FirstStepsState {
  steps: FirstStep[];
  doneCount: number;
  total: number;
  allDone: boolean;
}

export function computeFirstSteps(input: FirstStepsInput): FirstStepsState {
  const saved = Number.isFinite(input.savedWords) ? Math.max(0, Math.floor(input.savedWords)) : 0;
  const due = Number.isFinite(input.dueCount) ? Math.max(0, Math.floor(input.dueCount)) : 0;
  const done: Record<FirstStepKey, boolean> = {
    read: input.hasRead,
    "save-words": saved >= FIRST_STEPS_WORD_TARGET,
    review: input.hasReviewed,
  };

  const drafts: Omit<FirstStep, "status">[] = [
    {
      key: "read",
      title: "Прочитай одну страницу",
      hint: done.read ? "Готово" : "Открой текст и нажимай на незнакомые слова",
      href: done.read ? null : "/library",
    },
    {
      key: "save-words",
      title: `Сохрани ${FIRST_STEPS_WORD_TARGET} слов`,
      hint: done["save-words"] ? "Готово" : `${saved} из ${FIRST_STEPS_WORD_TARGET}`,
      href: done["save-words"] ? null : "/library",
    },
    {
      key: "review",
      title: "Пройди первое повторение",
      hint: done.review ? "Готово" : due > 0 ? `Карточек к повтору: ${due}` : "Откроется, когда слова будут готовы к повтору",
      href: done.review || due === 0 ? null : "/brain/all/review",
    },
  ];

  // «Текущий» — первый невыполненный шаг, остальные невыполненные — «следующие».
  let currentAssigned = false;
  const steps: FirstStep[] = drafts.map((draft) => {
    if (done[draft.key]) return { ...draft, status: "done" };
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...draft, status: "current" };
    }
    return { ...draft, status: "upcoming" };
  });

  const doneCount = steps.filter((s) => s.status === "done").length;
  return { steps, doneCount, total: steps.length, allDone: doneCount === steps.length };
}

/** Чек-лист виден, пока аккаунт молод и шаги не закончились. */
export function shouldShowFirstSteps(state: FirstStepsState, accountAgeDays: number): boolean {
  return !state.allDone && accountAgeDays >= 0 && accountAgeDays < FIRST_STEPS_MAX_ACCOUNT_AGE_DAYS;
}
