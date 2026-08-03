"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

// Server component (page.tsx) не может звать posthog-js напрямую (требует
// window) — тот же паттерн, что и TodayAnalytics в (app)/home. Без due_count
// напрямую (только privacy-safe свойства, docs/ui/analytics-events.md).
export default function ProgressViewTracker() {
  useEffect(() => {
    track("progress_viewed", {
      viewport_type: window.innerWidth < 768 ? "mobile" : "desktop",
    });
  }, []);

  return null;
}
