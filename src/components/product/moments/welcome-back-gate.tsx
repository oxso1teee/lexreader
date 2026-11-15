"use client";

import { useEffect, useRef } from "react";
import { useMoments } from "./moment-provider";
import { fetchWelcomeBackMomentAction } from "./welcome-back-actions";

// docs/moments/ROADMAP.md, этап 7 — Welcome-back "≥3 дня без входа".
// Условие (≥3 дня) целиком серверное (last_active_date) — гейт здесь
// только чтобы спросить один раз за загрузку приложения, тот же
// ref-гвард, что у WeeklyRankGate.
export default function WelcomeBackGate() {
  const { pushMoments } = useMoments();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void fetchWelcomeBackMomentAction().then((moment) => {
      if (moment) pushMoments([moment]);
    });
  }, [pushMoments]);

  return null;
}
