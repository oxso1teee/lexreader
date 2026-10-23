"use client";

import { useEffect, useRef } from "react";
import { useMoments } from "./moment-provider";
import { fetchTwinInsightMomentAction } from "./twin-insight-actions";

// docs/moments/ROADMAP.md, этап 4 — Twin-insight "по понедельникам", тот же
// приём, что WeeklyRankGate/WeekRecapGate.
export default function TwinInsightGate() {
  const { pushMoments } = useMoments();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (new Date().getDay() !== 1) return; // 1 = понедельник
    fired.current = true;
    void fetchTwinInsightMomentAction().then((moment) => {
      if (moment) pushMoments([moment]);
    });
  }, [pushMoments]);

  return null;
}
