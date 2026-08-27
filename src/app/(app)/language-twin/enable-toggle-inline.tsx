"use client";

import { useTransition } from "react";
import { track } from "@/lib/posthog-client";
import { updateSettingsAction } from "./actions";

export default function EnableToggleInline() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        track("language_twin_enabled", {});
        startTransition(() => updateSettingsAction({ enabled: true }));
      }}
      className="focus-ring mt-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {isPending ? "Включаем…" : "Включить Language Twin"}
    </button>
  );
}
