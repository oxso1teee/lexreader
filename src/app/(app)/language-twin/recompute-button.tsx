"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { track } from "@/lib/posthog-client";
import { Button } from "@/components/ui/button";
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

  // Компонентный API (primary/secondary) не меняется — маппится на варианты Button.
  const buttonVariant = variant === "primary" ? "leaf" : "ghost";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={buttonVariant} size="sm" onClick={handleClick} disabled={isPending} className="gap-1.5">
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Пересчитываем…" : "Пересчитать"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger-text)]">
          {error}
        </p>
      )}
    </div>
  );
}
