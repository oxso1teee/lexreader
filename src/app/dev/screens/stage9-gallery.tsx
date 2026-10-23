"use client";

// Сверка с макетами (docs/moments/reference) экранов, которые живьём
// требуют авторизации/данных: занятие (сборка, аудирование, итог, комбо),
// задания дня, сундук, двойной XP, онбординг. Обработчики создаются здесь,
// на клиенте (см. комментарий в stage3-gallery.tsx).
import { LESSON_CHOICE_FIXTURE } from "@/lib/screen-fixtures";
import LessonBuildMode from "@/app/(app)/brain/[deckId]/review/lesson-build-mode";
import LessonListenMode from "@/app/(app)/brain/[deckId]/review/lesson-listen-mode";
import SessionComplete from "@/app/(app)/brain/[deckId]/review/session-complete";
import MultipleChoiceMode from "@/app/(app)/brain/[deckId]/review/multiple-choice-mode";
import { ComboBanner } from "@/app/(app)/brain/[deckId]/review/screens/combo-banner";
import { DailyQuestsCard } from "@/components/product/quests/daily-quests-card";
import { ChestScreen } from "@/components/product/quests/chest-screen";
import { DoubleXpScreen } from "@/components/product/quests/double-xp-screen";
import ResultView from "@/app/onboarding/result/result-view";
import GoalPickClient from "@/app/onboarding/goal/goal-pick-client";
import StreakCommitClient from "@/app/onboarding/streak/streak-commit-client";
import FirstTextView from "@/app/onboarding/first-text/first-text-view";

const BUILD_CARDS = LESSON_CHOICE_FIXTURE.map((c) => ({
  ...c,
  contextSentence: c.contextSentence ?? "She was reluctant to leave the lighthouse.",
  contextTranslation: c.front === "reluctant" ? "Ей не хотелось уходить с маяка" : c.contextTranslation,
}));

// Время буста — 14 минут от загрузки модуля (вне рендера: render должен быть чистым).
const BOOST_UNTIL = new Date(Date.now() + 14 * 60_000).toISOString();

export function Stage9GalleryScreen({ s }: { s: string }) {
  if (s === "Lesson-build") return <LessonBuildMode cards={BUILD_CARDS} />;
  if (s === "Lesson-listen") return <LessonListenMode cards={LESSON_CHOICE_FIXTURE} targetLanguage="en" />;
  if (s === "Result")
    return (
      <SessionComplete
        count={12}
        cards={LESSON_CHOICE_FIXTURE.map((c) => ({ front: c.front, back: c.back }))}
        xpEarned={42}
        newWordsCount={4}
        durationSec={192}
        streakLongest={14}
      />
    );
  if (s === "Combo")
    return (
      <>
        <MultipleChoiceMode cards={LESSON_CHOICE_FIXTURE} studyDirection="front_back" />
        <ComboBanner combo={5} xpAwarded={5} />
      </>
    );
  if (s === "Daily-quests")
    return (
      <main className="min-h-dvh bg-background p-5 pt-16">
        <DailyQuestsCard
          defs={[
            { questType: "read_minutes", target: 10 },
            { questType: "review_words", target: 15 },
            { questType: "combo_streak", target: 5 },
          ]}
          progress={{ read_minutes: 10, review_words: 9, combo_streak: 2 }}
          allComplete={false}
          chestClaimedToday={false}
        />
      </main>
    );
  if (s === "Chest") return <ChestScreen />;
  if (s === "Double-XP") return <DoubleXpScreen boostUntil={BOOST_UNTIL} reviewHref="/brain/all/review" />;
  if (s === "Placement-result")
    return (
      <ResultView
        isSkipped={false}
        hasConflict={false}
        selfReportedCefr="B1"
        result={{
          range: "A2–B1",
          confidence: "medium",
          correctCount: 9,
          questionCount: 12,
          categoryScores: {},
          strongCategories: ["tense", "preposition"],
          weakCategories: ["article", "conditional"],
        }}
      />
    );
  if (s === "Goal-pick") return <GoalPickClient initialXpGoal={20} />;
  if (s === "Streak-commit") return <StreakCommitClient />;
  if (s === "First-text")
    return (
      <FirstTextView
        textId="fixture-text"
        title="The Last Lighthouse"
        levelTag="A2–B1"
        wordCount={640}
        familiarity={{ uniqueWordCount: 280, knownWordCount: 241, newWordCount: 39, percentFamiliar: 86 }}
      />
    );
  return null;
}
