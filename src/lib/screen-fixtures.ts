import type { TodayViewProps } from "@/components/product/today/v7/today-view";
import type { WeekdayMark } from "@/lib/moments/types";

// Тестовые данные основных экранов для галереи /dev/screens — те же цифры,
// что на макетах v7 (docs/moments/reference/*.png), чтобы сверять раскладку.
export const TODAY_FIXTURE: TodayViewProps = {
  langCode: "EN",
  level: "B1",
  streak: 12,
  streakLongest: 21,
  xp: 1240,
  greeting: "Доброе утро",
  firstName: "Сергей",
  xpToday: 30,
  xpGoal: 50,
  dueCount: 18,
  marks: ["done", "done", "done", "today", "future", "future", "future"],
  hero: {
    eyebrow: "Занятие на сегодня",
    title: "Слова из «The Last Lighthouse»",
    meta: ["12 заданий", "~5 мин", "3 новых слова"],
    ctaLabel: "Начать занятие",
    href: "/brain/all/review",
    actionType: "review",
  },
  continueReading: { textId: "fixture", title: "The Last Lighthouse", percentRead: 64 },
  continueIsVideo: false,
  pathCard: null,
  pendingRecommendationsCount: 0,
  topPatterns: [],
};

// docs/moments/mockups/Today-evening.dc.html
export const TODAY_EVENING_FIXTURE = {
  langCode: "EN",
  level: "B1",
  streak: 12,
  streakLongest: 21,
  xp: 1240,
  week: ["done", "done", "done", "today", "empty", "empty", "empty"] as WeekdayMark[],
  freezeAvailable: true,
  reviewHref: "/brain/all/review",
  reviewMinutesHint: 3,
};

// docs/moments/ROADMAP.md, этап 3 — Lesson-start/Halfway/Mistakes/
// Quit-confirm (review-session.tsx) и Lesson-choice (multiple-choice-mode.tsx).
export const LESSON_START_FIXTURE = {
  sessionTitle: "The Last Lighthouse",
  newCardsCount: 8,
  reviewCardsCount: 6,
};

export const HALFWAY_FIXTURE = {
  combo: 5,
  xpSoFar: 18,
  cardsRemaining: 6,
};

export const MISTAKES_FIXTURE = {
  words: [
    { front: "reluctant", back: "неохотный" },
    { front: "spiral", back: "спираль" },
  ],
};

export const QUIT_CONFIRM_FIXTURE = {
  cardsDone: 7,
  cardsTotal: 12,
  combo: 5,
  perfectBonusAtRisk: true,
  perfectBonusXp: 10,
};

// multiple-choice-mode.tsx ожидает полноценные ReviewCard — минимальный
// набор из мокапа Lesson-choice.dc.html (refuge/reluctant), fsrsState нулями
// (режим "choice" их не читает, только cards-mode).
const EMPTY_FSRS_STATE = {
  fsrsStability: null,
  fsrsDifficulty: null,
  fsrsState: null,
  fsrsLapses: 0,
  fsrsReps: 0,
  fsrsScheduledDays: 0,
  dueAt: new Date().toISOString(),
  lastReviewedAt: null,
};

export const LESSON_CHOICE_FIXTURE = [
  {
    flashcardId: "fixture-1",
    deckId: "fixture",
    front: "reluctant",
    back: "неохотный",
    notes: null,
    contextSentence: "She was reluctant to leave the lighthouse.",
    contextTranslation: null,
    photoUrl: null,
    sourceTextId: "fixture-text",
    sourceTextTitle: "The Last Lighthouse",
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
    fsrsState: EMPTY_FSRS_STATE,
  },
  {
    flashcardId: "fixture-2",
    deckId: "fixture",
    front: "refuge",
    back: "убежище",
    notes: null,
    contextSentence: null,
    contextTranslation: null,
    photoUrl: null,
    sourceTextId: null,
    sourceTextTitle: null,
    easeFactor: 2.5,
    intervalDays: 6,
    repetitions: 3,
    fsrsState: EMPTY_FSRS_STATE,
  },
  {
    flashcardId: "fixture-3",
    deckId: "fixture",
    front: "spiral",
    back: "спираль",
    notes: null,
    contextSentence: null,
    contextTranslation: null,
    photoUrl: null,
    sourceTextId: null,
    sourceTextTitle: null,
    easeFactor: 2.5,
    intervalDays: 6,
    repetitions: 2,
    fsrsState: EMPTY_FSRS_STATE,
  },
  {
    flashcardId: "fixture-4",
    deckId: "fixture",
    front: "confident",
    back: "уверенный",
    notes: null,
    contextSentence: null,
    contextTranslation: null,
    photoUrl: null,
    sourceTextId: null,
    sourceTextTitle: null,
    easeFactor: 2.5,
    intervalDays: 6,
    repetitions: 4,
    fsrsState: EMPTY_FSRS_STATE,
  },
];
