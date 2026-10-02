"use client";

import { useTransition } from "react";
import { track } from "@/lib/posthog-client";
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "./actions";

export default function EnableToggleInline() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="leaf"
      size="sm"
      disabled={isPending}
      onClick={() => {
        track("language_twin_enabled", {});
        startTransition(() => updateSettingsAction({ enabled: true }));
      }}
      className="mt-2"
    >
      {isPending ? "Включаем…" : "Включить Language Twin"}
    </Button>
  );
}
