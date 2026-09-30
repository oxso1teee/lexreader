"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPathAction, pausePathAction } from "./actions";
import { track } from "@/lib/posthog-client";
import { Button } from "@/components/ui/button";
import type { PathSlug } from "@/lib/learning-paths/types";

// M3 Slice 8 — every button here maps to a real persisted mutation (plan
// doc's "active CTA" rule): Start/Resume -> a real enrollment row,
// Pause -> a real status update. No optimistic fake state — the page
// re-renders from the server action's result via router.refresh().
export function StartPathButton({
  pathSlug,
  label,
  switchingFrom,
  analyticsEvent,
}: {
  pathSlug: PathSlug;
  label: string;
  switchingFrom?: string | null;
  analyticsEvent: "learning_path_started" | "learning_path_resumed" | "learning_path_switched";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (switchingFrom && !confirm(`Сменить активный путь на этот? «${switchingFrom}» будет поставлен на паузу — прогресс сохранится.`)) {
      return;
    }
    startTransition(async () => {
      await startPathAction(pathSlug);
      track(analyticsEvent, { path_slug: pathSlug });
      router.refresh();
    });
  }

  return (
    <Button variant="leaf" onClick={handleClick} disabled={isPending} className="self-start">
      {isPending ? "…" : label}
    </Button>
  );
}

export function PausePathButton({ pathSlug }: { pathSlug: PathSlug }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await pausePathAction(pathSlug);
      track("learning_path_paused", { path_slug: pathSlug });
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={isPending} className="self-start">
      {isPending ? "…" : "Поставить на паузу"}
    </Button>
  );
}
