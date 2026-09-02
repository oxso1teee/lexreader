"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeLessonAction } from "../../../actions";
import { track } from "@/lib/posthog-client";
import type { PathSlug } from "@/lib/learning-paths/types";

// Content completion only (plan doc's "never collapse content completion
// and skill confidence into one click") — this button never touches
// confidence or status beyond not_started -> introduced.
export default function CompleteLessonButton({
  pathSlug,
  skillKey,
  alreadyCompleted,
}: {
  pathSlug: PathSlug;
  skillKey: string;
  alreadyCompleted: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (alreadyCompleted) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-success-text)]">
        <span aria-hidden="true">✓</span> Урок изучен
      </span>
    );
  }

  function handleClick() {
    startTransition(async () => {
      await completeLessonAction(pathSlug, skillKey);
      track("lesson_completed", { path_slug: pathSlug, skill_key: skillKey });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="focus-ring self-start rounded-full bg-forest px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
    >
      {isPending ? "…" : "Отметить как изученное"}
    </button>
  );
}
