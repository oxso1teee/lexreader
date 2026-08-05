"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

// page.tsx — server component, posthog-js требует window. Тот же паттерн,
// что и TodayAnalytics/ProgressViewTracker (docs/ui/analytics-events.md) —
// только privacy-safe свойства, никакого текста карточек/слов.
export default function PracticeAnalytics({ dueCountBucket }: { dueCountBucket: string }) {
  useEffect(() => {
    track("practice_viewed", {
      due_count_bucket: dueCountBucket,
      viewport_type: window.innerWidth < 768 ? "mobile" : "desktop",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
