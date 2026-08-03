// M3 UI slice 2 — Progress redesign: один динамический инсайт вместо
// статичного набора карточек. Приоритет ниже соответствует порядку примеров
// из промта задачи; чистая функция без побочных эффектов — тестируема без БД.
export type ProgressInsightKey =
  | "new_user"
  | "due_reviews"
  | "weekly_goal_met"
  | "reading_gap"
  | "words_without_reviews"
  | "steady";

export interface ProgressInsight {
  key: ProgressInsightKey;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface ProgressInsightInput {
  dueReviewsCount: number;
  totalWordsEver: number;
  hasEverRead: boolean;
  daysSinceLastReading: number | null;
  weeklyQuestProgress: number;
  weeklyQuestTarget: number;
  wordsAddedThisWeek: number;
  reviewsThisWeek: number;
}

const READING_GAP_DAYS = 7;
const WORDS_WITHOUT_REVIEWS_THRESHOLD = 10;

export function decideProgressInsight(input: ProgressInsightInput): ProgressInsight {
  if (input.totalWordsEver === 0 && !input.hasEverRead) {
    return {
      key: "new_user",
      message: "Добавь первый материал, чтобы здесь появился реальный прогресс.",
      ctaLabel: "Открыть библиотеку",
      ctaHref: "/library",
    };
  }

  if (input.dueReviewsCount > 0) {
    return {
      key: "due_reviews",
      message: `Есть ${input.dueReviewsCount} ${wordForm(input.dueReviewsCount)} к повторению.`,
      ctaLabel: "Повторить",
      ctaHref: "/brain/all/review",
    };
  }

  if (input.weeklyQuestProgress >= input.weeklyQuestTarget) {
    return {
      key: "weekly_goal_met",
      message: `Цель недели выполнена — ${input.weeklyQuestProgress} новых слов.`,
    };
  }

  if (input.daysSinceLastReading !== null && input.daysSinceLastReading >= READING_GAP_DAYS) {
    return {
      key: "reading_gap",
      message: `Давно не было чтения — ${input.daysSinceLastReading} ${dayForm(input.daysSinceLastReading)} назад.`,
      ctaLabel: "Открыть библиотеку",
      ctaHref: "/library",
    };
  }

  if (input.wordsAddedThisWeek >= WORDS_WITHOUT_REVIEWS_THRESHOLD && input.reviewsThisWeek === 0) {
    return {
      key: "words_without_reviews",
      message: `Добавлено ${input.wordsAddedThisWeek} слов на этой неделе, но пока ни одного повторения.`,
      ctaLabel: "Повторить",
      ctaHref: "/brain/all/review",
    };
  }

  return {
    key: "steady",
    message: "Прогресс стабильный — продолжай в том же темпе.",
  };
}

function wordForm(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "карточка";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "карточки";
  return "карточек";
}

function dayForm(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}
