import type { TodayViewProps } from "@/components/product/today/v7/today-view";
import type { WeekdayMark } from "@/lib/moments/types";
import type { DuelState, DuelClaimResult } from "@/lib/duel";

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

// docs/moments/ROADMAP.md, этап 6 — Duel-invite/Duel-won не ходят через
// очередь moments (показываются inline в /duel/[id]), поэтому для
// скриншот-сверки их фикстуры живут здесь же, как у Stage 3.
export const DUEL_INVITE_FIXTURE: DuelState = {
  id: "fixture-duel",
  status: "waiting",
  language: "en",
  roundCount: 10,
  currentRoundIndex: 0,
  creatorInitials: "АН",
  opponentInitials: null,
  creatorScore: 0,
  opponentScore: 0,
  isCreator: false,
  isParticipant: false,
  winnerIsMe: false,
  isDraw: false,
  inviteExpiresAt: new Date(Date.now() + 23 * 3600_000 + 15 * 60_000).toISOString(),
};

export const DUEL_WON_FIXTURE: { state: DuelState; result: DuelClaimResult } = {
  state: {
    id: "fixture-duel-won",
    status: "finished",
    language: "en",
    roundCount: 10,
    currentRoundIndex: 10,
    creatorInitials: "СП",
    opponentInitials: "АН",
    creatorScore: 10,
    opponentScore: 7,
    isCreator: true,
    isParticipant: true,
    winnerIsMe: true,
    isDraw: false,
    inviteExpiresAt: null,
  },
  result: {
    xpToAward: 25,
    winStreak: 3,
    speedMarginSec: 18,
    scoreMe: 10,
    scoreOpponent: 7,
  },
};
