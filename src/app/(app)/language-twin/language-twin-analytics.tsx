"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";
import type { ConfidenceLevel } from "@/lib/language-twin/types";

// page.tsx is a server component — posthog-js needs window, so the view
// event fires from this tiny mount-only client component instead (same
// pattern as home/today-analytics.tsx). No word/pattern/evidence content in
// the payload, just the confidence bucket already shown on screen.
export default function LanguageTwinAnalytics({ confidence }: { confidence: ConfidenceLevel | "none" }) {
  useEffect(() => {
    track("language_twin_viewed", { confidence });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
