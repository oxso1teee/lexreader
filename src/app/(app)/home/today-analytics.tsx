"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

// page.tsx — server component, posthog-js требует window. today_viewed
// фиксируется здесь один раз при монтировании страницы, без текста
// карточек/книг/email — только privacy-safe properties (docs/ui/analytics-events.md).
export default function TodayAnalytics({
  dueCountBucket,
  hasActiveMaterial,
}: {
  dueCountBucket: string;
  hasActiveMaterial: boolean;
}) {
  useEffect(() => {
    track("today_viewed", {
      due_count_bucket: dueCountBucket,
      has_active_material: hasActiveMaterial,
      viewport_type: window.innerWidth < 768 ? "mobile" : "desktop",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
