import type { TodayViewProps } from "@/components/product/today/v7/today-view";

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
