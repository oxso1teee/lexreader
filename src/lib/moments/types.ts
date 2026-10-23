// docs/moments/ROADMAP.md — «момент»: полноэкранный праздничный/важный экран,
// который всплывает после действия (как в Duolingo). Сервер решает, ЧТО
// случилось, и отдаёт список моментов; клиент (MomentProvider) показывает их
// по очереди. Каждый вид — отдельная ветка union, данные — только реальные.

export type WeekdayMark = "done" | "today" | "empty" | "freeze";

export interface GoalDoneMoment {
  kind: "goal_done";
  id: string;
  xpToday: number;
  xpGoal: number;
  minutesHint: number;
  /** Пн..Вс текущей ISO-недели. */
  week: WeekdayMark[];
}

export interface StreakUpMoment {
  kind: "streak_up";
  id: string;
  streak: number;
  week: WeekdayMark[];
  /** Друг с общей серией, который сегодня ещё не занимался (необязательно). */
  friend?: { name: string; initial: string; sharedStreak: number } | null;
}

// Этап 1 (docs/moments/ROADMAP.md) — итог занятия/чтения: без ошибок, новый
// уровень, достижение, слово выучено.
export interface PerfectMoment {
  kind: "perfect";
  id: string;
  /** Карточек в сессии — все с первой попытки (grade 2 или 3). */
  cardCount: number;
  durationSec: number;
  /** Реально начисленный бонус (addXp), не декоративное число. */
  bonusXp: number;
}

export interface LevelUpMoment {
  kind: "level_up";
  id: string;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

// achievementId — ключ в src/lib/achievements.ts ACHIEVEMENTS; экран сам
// смотрит там title/description/icon, а не дублирует их здесь — один
// источник правды, та же схема, что у AchievementsShelf.
export interface AchievementMoment {
  kind: "achievement";
  id: string;
  achievementId: string;
}

export interface WordMasteredMoment {
  kind: "word_mastered";
  id: string;
  front: string;
  back: string;
  /** Всего ревью этой карточки (review_log). */
  timesSeen: number;
  /** Из них с оценкой "Помню"/"Легко". */
  timesCorrect: number;
  /** Сколько слов этого языка у пользователя сейчас в learning_state="maintenance". */
  totalMastered: number;
}

// Этап 2 (docs/moments/ROADMAP.md) — рубежи, заморозка, идеальная неделя,
// восстановление серии.
export interface StreakMilestoneMoment {
  kind: "streak_milestone";
  id: string;
  milestone: number;
  /** Следующий рубеж из STREAK_MILESTONES — null после 365 (последний). */
  nextMilestone: number | null;
}

export interface FreezeUsedMoment {
  kind: "freeze_used";
  id: string;
  streak: number;
  /** Пн..Вс текущей ISO-недели — freeze-день размечен отдельно macoй
   *  WeekdayMark "freeze". */
  week: WeekdayMark[];
}

export interface PerfectWeekMoment {
  kind: "perfect_week";
  id: string;
  /** Реально начисленный бонус (addXp), не декоративное число. */
  xpAwarded: number;
}

// Экран показывается, когда серия ТОЛЬКО прервалась (repairStarted) и даёт
// 3 дня на восстановление — не когда восстановление уже завершилось (успешное
// завершение — обычный streak_up с восстановленным числом, у него нет
// отдельного макета).
export interface EarnBackMoment {
  kind: "earn_back";
  id: string;
  streakBeforeBreak: number;
}

// Этап 6 (docs/moments/ROADMAP.md) — друзья и соревнование. Overtaken/
// Weekly-rank/Friend-streak идут через обычную очередь (ниже); Duel-won
// показывается inline в /duel/[id] (duel-room.tsx), не через очередь — у
// него нет отдельной ветки в Moment/MOMENT_PRIORITY, своя узкая форма пропсов
// экспортируется отдельно из src/lib/duel.ts (DuelClaimResult).
export interface OvertakenMoment {
  kind: "overtaken";
  id: string;
  friendName: string;
  friendInitial: string;
  theirRank: number;
  xpGapToReclaim: number;
}

export interface WeeklyRankPodiumEntry {
  rank: 1 | 2 | 3;
  name: string;
  initial: string;
  score: number;
}

export interface WeeklyRankMoment {
  kind: "weekly_rank";
  id: string;
  /** "13–19 окт". */
  weekLabel: string;
  myRank: number;
  myScore: number;
  /** null — уже в топ-3, либо соседа снизу нет. */
  xpGapToNextTier: number | null;
  podium: WeeklyRankPodiumEntry[];
  rowBelow: { rank: number; name: string; initial: string; score: number } | null;
}

export interface FriendStreakPartnerView {
  /** profiles.id партнёра — нужен remindFriendAction (кнопка "Позвать"). */
  id: string;
  name: string;
  initial: string;
  personalStreak: number;
}

export interface FriendStreakMoment {
  kind: "friend_streak";
  id: string;
  sharedStreak: number;
  friendName: string;
  partners: FriendStreakPartnerView[];
}

// Этап 7 (docs/moments/ROADMAP.md) — первый запуск и система.
export interface NotifyAskMoment {
  kind: "notify_ask";
  id: string;
}

export interface WelcomeBackMoment {
  kind: "welcome_back";
  id: string;
  name: string;
  daysAway: number;
  /** getDueCount — реально просроченные карточки, не декоративное число. */
  dueReviewCount: number;
  continueChapter: { textId: string; collectionTitle: string; chapterPosition: number } | null;
}

export interface RateAppMoment {
  kind: "rate_app";
  id: string;
}

export interface WeekRecapWordOfWeek {
  headword: string;
  translation: string;
  contextSentence: string | null;
  timesSeen: number;
  timesCorrect: number;
}

export interface WeekRecapMoment {
  kind: "week_recap";
  id: string;
  /** "13–19 окт". */
  weekLabel: string;
  newWordsCount: number;
  alreadyKnownCount: number;
  wordOfWeek: WeekRecapWordOfWeek | null;
  minutesRead: number;
  chaptersRead: number;
  activeDays: number;
}

// Этап 4 (docs/moments/ROADMAP.md) — чтение и слова.
export interface ChapterDoneMoment {
  kind: "chapter_done";
  id: string;
  textTitle: string;
  collectionTitle: string;
  /** Позиция текста внутри коллекции (texts.collection_order), как уже
   *  считает welcome-back-actions.ts для continueChapter. */
  chapterPosition: number;
  wordsRead: number;
  /** Новых слов, сохранённых в карточки за эту конкретную сессию чтения. */
  newWordsCount: number;
  /** Первые до 4 из этих слов — чипы «Слова главы в твоих карточках». */
  newWords?: string[];
  /** comprehensionPercent(): доля слов без подсказки перевода. */
  comprehension?: number;
  /** Последний абзац текста — «страница» в открывающейся книжке. */
  excerpt?: string;
  /** Следующий текст той же коллекции по collection_order — null, если это
   *  последний (коллекция прочитана полностью). */
  nextTextId: string | null;
}

export interface ReviewDueMoment {
  kind: "review_due";
  id: string;
  /** getDueCount — реально просроченные карточки, не декоративное число. */
  dueCount: number;
  /** Первые просроченные слова (front карточек), до 5 — чипы на экране. */
  words?: string[];
  /** estimateReviewMinutes(dueCount). */
  minutes?: number;
}

export interface TwinInsightSkillDelta {
  category: string;
  label: string;
  trend: "up" | "down" | "flat";
  status: "weak" | "developing" | "strong";
}

export interface TwinInsightMoment {
  kind: "twin_insight";
  id: string;
  weekLabel: string;
  skills: TwinInsightSkillDelta[];
  /** Самый слабый паттерн недели (pickTopPattern) — честная рекомендация
   *  фокуса, не выдуманная. null, если данных ещё нет. */
  focusLabel: string | null;
}

export interface UnitDoneMoment {
  kind: "unit_done";
  id: string;
  pathTitle: string;
  stageTitle: string;
  stageIndex: number;
  stagesTotal: number;
  skillsInStage: number;
  nextStageTitle: string | null;
}

export type Moment =
  | GoalDoneMoment
  | StreakUpMoment
  | PerfectMoment
  | LevelUpMoment
  | AchievementMoment
  | WordMasteredMoment
  | StreakMilestoneMoment
  | FreezeUsedMoment
  | PerfectWeekMoment
  | EarnBackMoment
  | OvertakenMoment
  | WeeklyRankMoment
  | FriendStreakMoment
  | NotifyAskMoment
  | WelcomeBackMoment
  | RateAppMoment
  | WeekRecapMoment
  | ChapterDoneMoment
  | ReviewDueMoment
  | TwinInsightMoment
  | UnitDoneMoment;
export type MomentKind = Moment["kind"];

// Порядок показа после занятия (ROADMAP, этап 1/2): Result (не момент — сам
// экран итога) → Perfect → Goal-done → Streak-milestone → Streak-up/
// Freeze-used/Earn-back (ровно один из трёх — взаимоисключающие, см.
// collectMoments) → Perfect-week → Level-up/Achievement → Word-mastered.
// Чем выше число, тем раньше показываем.
export const MOMENT_PRIORITY: Record<MomentKind, number> = {
  perfect: 60,
  goal_done: 50,
  streak_milestone: 45,
  streak_up: 40,
  freeze_used: 40,
  earn_back: 40,
  perfect_week: 35,
  level_up: 30,
  achievement: 30,
  word_mastered: 20,
  // Этап 6 — социальные уведомления: не блокируют итог занятия (не входят
  // в основную цепочку после сессии), но заметнее, чем просто "информация".
  overtaken: 38,
  friend_streak: 38,
  weekly_rank: 25,
  // Этап 7 — не блокируют итог занятия: notify_ask идёт почти в конце
  // батча (после первого занятия, рядом с word_mastered), rate_app —
  // самым последним (показывается следом за уже показанным позитивным
  // моментом, см. moment-provider.tsx). Welcome-back/Week-recap приходят
  // отдельным push от гейта, приоритет среди них не играет роли.
  notify_ask: 15,
  week_recap: 25,
  welcome_back: 15,
  rate_app: 5,
  // Этап 4 — чтение/слова: chapter_done идёт сразу после сессионного итога
  // чтения (та же "роль", что perfect/goal_done у review-сессии); unit_done
  // заметнее, чем обычная похвала — закрытие целого раздела пути;
  // review_due/twin_insight — информационные гейты, не блокируют итог.
  chapter_done: 55,
  unit_done: 32,
  review_due: 18,
  twin_insight: 22,
};

/** Больше подряд не показываем — остальные подождут следующего действия. */
export const MAX_MOMENTS_IN_A_ROW = 3;
