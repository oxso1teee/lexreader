"use client";

// dev/screens/page.tsx (Server Component) can't pass inline onReady/
// onContinue/etc. callbacks as props to these Client Components directly
// ("Event handlers cannot be passed to Client Component props" — functions
// aren't serializable across the RSC boundary). Fixture data (plain
// objects) crosses fine; the no-op handlers just need to be created here,
// on the client.
import {
  LESSON_START_FIXTURE,
  HALFWAY_FIXTURE,
  MISTAKES_FIXTURE,
  QUIT_CONFIRM_FIXTURE,
  LESSON_CHOICE_FIXTURE,
} from "@/lib/screen-fixtures";
import { LessonStartScreen } from "@/app/(app)/brain/[deckId]/review/screens/lesson-start";
import { HalfwayScreen } from "@/app/(app)/brain/[deckId]/review/screens/halfway";
import { MistakesScreen } from "@/app/(app)/brain/[deckId]/review/screens/mistakes";
import { QuitConfirmSheet } from "@/app/(app)/brain/[deckId]/review/screens/quit-confirm";
import MultipleChoiceMode from "@/app/(app)/brain/[deckId]/review/multiple-choice-mode";

const noop = () => {};

export function Stage3GalleryScreen({ s }: { s: string }) {
  if (s === "Lesson-start") return <LessonStartScreen {...LESSON_START_FIXTURE} onReady={noop} />;
  if (s === "Halfway") return <HalfwayScreen {...HALFWAY_FIXTURE} onContinue={noop} />;
  if (s === "Mistakes") return <MistakesScreen words={MISTAKES_FIXTURE.words} onRetry={noop} onSkip={noop} />;
  if (s === "Quit-confirm") return <QuitConfirmSheet {...QUIT_CONFIRM_FIXTURE} onStay={noop} onLeave={noop} />;
  if (s === "Lesson-choice") return <MultipleChoiceMode cards={LESSON_CHOICE_FIXTURE} studyDirection="front_back" />;
  return null;
}
