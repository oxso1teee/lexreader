"use client";

import { useEffect, useRef } from "react";
import { useMoments } from "./moment-provider";
import { fetchWeekRecapMomentAction } from "./week-recap-actions";

// docs/moments/ROADMAP.md, этап 7 — Week-recap "по понедельникам", тот же
// приём, что WeeklyRankGate.
export default function WeekRecapGate() {
  const { pushMoments } = useMoments();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (new Date().getDay() !== 1) return; // 1 = понедельник
    fired.current = true;
    void fetchWeekRecapMomentAction().then((moment) => {
      if (moment) pushMoments([moment]);
    });
  }, [pushMoments]);

  return null;
}
