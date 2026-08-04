"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/posthog-client";
import type { CreateTextState } from "../actions";

// M3 Slice 3: server actions now return { redirectTo } instead of calling
// redirect() themselves (docs/ui/m3-slice3-library-reader-plan.md §9) — that
// gives this hook a real point to fire material_add_succeeded from, which a
// server-side redirect() (throws NEXT_REDIRECT, skips client code) never did.
// Never sends title/body/url — only the source type and a coarse failure
// reason, matching the approved no-PII event list.
export type AddMaterialSource = "text" | "file_pdf" | "file_photo" | "youtube" | "url" | "transcript";

export function useAddMaterialAction(
  source: AddMaterialSource,
  action: (prevState: CreateTextState, formData: FormData) => Promise<CreateTextState>,
  initialState: CreateTextState,
) {
  const router = useRouter();
  return useActionState<CreateTextState, FormData>(async (prev, formData) => {
    track("material_add_started", { source });
    const result = await action(prev, formData);
    if (result.redirectTo) {
      track("material_add_succeeded", { source });
      router.push(result.redirectTo);
    } else if (result.paywall) {
      track("material_add_failed", { source, reason: "limit" });
    } else if (result.error) {
      track("material_add_failed", { source, reason: "validation_or_server" });
    }
    return result;
  }, initialState);
}
