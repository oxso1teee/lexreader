"use client";

import { useEffect, useRef } from "react";
import { useMoments } from "./moment-provider";
import { fetchReviewDueMomentAction } from "./review-due-actions";

// docs/moments/ROADMAP.md, этап 4 — Review-due. Тот же приём, что у
// WeeklyRankGate/TodayEveningGate: проверка на монтировании корневого
// layout, ref-гвард от повторного пуша при HMR/remount.
export default function ReviewDueGate() {
  const { pushMoments } = useMoments();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void fetchReviewDueMomentAction().then((moment) => {
      if (moment) pushMoments([moment]);
    });
  }, [pushMoments]);

  return null;
}
