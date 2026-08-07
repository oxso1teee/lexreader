"use client";

import { useState, useTransition } from "react";
import { track } from "@/lib/posthog-client";
import { recomputeAction } from "./actions";

export default function RecomputeButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    track("profile_recompute_requested", {});
    startTransition(async () => {
      const result = await recomputeAction();
      if (!result.ok) setError(result.error ?? "Не удалось пересчитать профиль.");
    });
  }

  const className =
    variant === "primary"
      ? "focus-ring rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      : "focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={isPending} className={className}>
        {isPending ? "Пересчитываем…" : "↻ Пересчитать"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger-text)]">
          {error}
        </p>
      )}
    </div>
  );
}
