import type { DashboardViewProps } from "@/components/product/dashboard/dashboard-view";
import { computeFirstSteps } from "@/lib/dashboard/first-steps";
import { dailyGoalProgress } from "@/lib/dashboard/goal";
import { buildWantMore } from "@/lib/dashboard/want-more";
import type { WeekdayMark } from "@/lib/moments/types";
import type { DuelState, DuelClaimResult } from "@/lib/duel";

// Тестовые данные главного экрана для галереи /dev/screens (фикстуры
// допустимы только в /dev/*; в приложении экран получает реальные данные).
// «Мир продукта» тот же, что на макетах Ultimate DS: Сергей, B1, серия 12,
// The Last Lighthouse.
const READING = { textId: "fixture", title: "The Last Lighthouse", percentRead: 64 };

const REVIEW_HERO = {
  eyebrow: "Пора повторить",
  title: "18 к повторению",
  meta: ["18 карточек", "~5 мин"],
  ctaLabel: "Повторить сейчас",
  href: "/brain/all/review",
  actionType: "review",
};

const ADD_MATERIAL_HERO = {
  eyebrow: undefined,
  title: "Добавь первый материал",
  subtitle: "Читай что угодно интересное — LexReader сохранит незнакомые слова и создаст повторение.",
  meta: [] as string[],
  ctaLabel: "Добавить материал",
  href: "/library/new",
  actionType: "add_material",
};

const DASHBOARD_BASE: DashboardViewProps = {
  mode: "regular",
  serverGreeting: "Доброе утро",
  firstName: "Сергей",
  email: "sergey@example.com",
  langCode: "EN",
  level: "B1",
  xp: 1240,
  streak: { value: 12, longest: 21, state: "alive" },
  goal: dailyGoalProgress(30, 50),
  summary: [],
  dueCount: 18,
  week: ["done", "done", "done", "today", "empty", "empty", "empty"],
  todayColumn: 3,
  learningGoal: "Путешествия",
  pathLabel: "B1 → B2",
  hero: REVIEW_HERO,
  continueReading: READING,
  continueIsVideo: false,
  lastActivity: "вчера",
  path: { href: "/learning-paths/fixture", label: "B1 → B2", title: "Present Perfect и Past Simple", percent: 38 },
  showPathInvite: false,
  firstSteps: null,
  wantMore: [],
  pendingRecommendationsCount: 2,
  topPatterns: [
    { category: "article", title: "Артикли", status: "active" },
    { category: "tense", title: "Времена", status: "improving" },
  ],
};

/** Обычный день: цель 30/50, серия жива, есть что повторять и дочитывать. */
export const DASHBOARD_REGULAR_FIXTURE: DashboardViewProps = DASHBOARD_BASE;

/** Первый день (Today-new): ни XP, ни действий, чек-лист 0 из 3, пустая неделя. */
export const DASHBOARD_FIRST_DAY_FIXTURE: DashboardViewProps = {
  ...DASHBOARD_BASE,
  mode: "first-day",
  xp: 0,
  streak: { value: 0, longest: 0, state: "none" },
  goal: dailyGoalProgress(0, 50),
  dueCount: 0,
  week: ["empty", "empty", "empty", "today", "empty", "empty", "empty"],
  pathLabel: null,
  hero: ADD_MATERIAL_HERO,
  continueReading: null,
  lastActivity: null,
  path: null,
  firstSteps: computeFirstSteps({ hasRead: false, savedWords: 0, hasReviewed: false, dueCount: 0 }),
  pendingRecommendationsCount: 0,
  topPatterns: [],
};

/** Цель дня выполнена (Today-done): 50/50, серия продлена, блок «Хочешь ещё?». */
export const DASHBOARD_GOAL_DONE_FIXTURE: DashboardViewProps = {
  ...DASHBOARD_BASE,
  mode: "goal-done",
  xp: 1290,
  streak: { value: 13, longest: 21, state: "extended" },
  goal: dailyGoalProgress(50, 50),
  summary: ["12 мин чтения", "18 повторений", "9 новых слов"],
  week: ["done", "done", "done", "done", "empty", "empty", "empty"],
  wantMore: buildWantMore({
    hero: {
      eyebrow: REVIEW_HERO.eyebrow,
      title: REVIEW_HERO.title,
      subtitle: REVIEW_HERO.meta.join(" · "),
      ctaLabel: REVIEW_HERO.ctaLabel,
      href: REVIEW_HERO.href,
      actionType: REVIEW_HERO.actionType,
    },
    continueReading: READING,
    dueCount: 18,
  }),
};

/** Пустые состояния: серия прервана, нечего дочитывать и повторять, путь не выбран, один блок не загрузился. */
export const DASHBOARD_EMPTY_FIXTURE: DashboardViewProps = {
  ...DASHBOARD_BASE,
  streak: { value: 0, longest: 21, state: "broken" },
  goal: dailyGoalProgress(0, 50),
  dueCount: 0,
  week: ["done", "done", "empty", "today", "empty", "empty", "empty"],
  pathLabel: null,
  hero: ADD_MATERIAL_HERO,
  continueReading: null,
  lastActivity: "5 дней назад",
  path: null,
  showPathInvite: true,
  pendingRecommendationsCount: 0,
  topPatterns: [],
  notices: ["Задания дня"],
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
