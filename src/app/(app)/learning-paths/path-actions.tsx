"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPathAction, pausePathAction } from "./actions";
import { track } from "@/lib/posthog-client";
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
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="focus-ring self-start rounded-full bg-forest px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
    >
      {isPending ? "…" : label}
    </button>
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
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="focus-ring self-start rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50"
    >
      {isPending ? "…" : "Поставить на паузу"}
    </button>
  );
}
