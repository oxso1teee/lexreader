"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeLessonAction } from "../../../actions";
import { track } from "@/lib/posthog-client";
import { Button } from "@/components/ui/button";
import type { PathSlug } from "@/lib/learning-paths/types";
import { useMoments } from "@/components/product/moments/moment-provider";

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
  const { pushMoments } = useMoments();

  if (alreadyCompleted) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-success-text)]">
        <Check aria-hidden="true" className="h-4 w-4" /> Урок изучен
      </span>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const result = await completeLessonAction(pathSlug, skillKey);
      track("lesson_completed", { path_slug: pathSlug, skill_key: skillKey });
      if (result?.unitDoneMoment) pushMoments([result.unitDoneMoment]);
      router.refresh();
    });
  }

  return (
    <Button variant="leaf" onClick={handleClick} disabled={isPending} className="self-start">
      {isPending ? "…" : "Отметить как изученное"}
    </Button>
  );
}
