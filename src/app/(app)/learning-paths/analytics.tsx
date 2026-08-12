"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

// M3 Slice 8 §"analytics/privacy": one generic view-tracker for the four
// read-only Learning Paths screens (Catalog/Path/Stage/Skill), mirroring
// ProgressViewTracker/TodayAnalytics's "server component can't call
// posthog-js" pattern. Payload is restricted to the closed event list's
// allowed fields — never sentence/word/answer content.
export default function LearningPathsViewTracker({ event, props }: { event: string; props?: Record<string, unknown> }) {
  useEffect(() => {
    track(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
