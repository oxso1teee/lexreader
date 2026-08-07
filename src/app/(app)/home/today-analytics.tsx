"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

// page.tsx — server component, posthog-js требует window. today_viewed
// фиксируется здесь один раз при монтировании страницы, без текста
// карточек/книг/email — только privacy-safe properties (docs/ui/analytics-events.md).
export default function TodayAnalytics({
  dueCountBucket,
  hasActiveMaterial,
  missionCount,
}: {
  dueCountBucket: string;
  hasActiveMaterial: boolean;
  missionCount: number;
}) {
  useEffect(() => {
    track("today_viewed", {
      due_count_bucket: dueCountBucket,
      has_active_material: hasActiveMaterial,
      viewport_type: window.innerWidth < 768 ? "mobile" : "desktop",
    });
    // Missions v1: a plain count, never which missions or their titles —
    // same privacy bar as the rest of this event.
    if (missionCount > 0) track("mission_impression", { mission_count: missionCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
