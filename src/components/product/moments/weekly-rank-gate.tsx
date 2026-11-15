"use client";

import { useEffect, useRef } from "react";
import { useMoments } from "./moment-provider";
import { fetchWeeklyRankMomentAction } from "./weekly-rank-actions";

// docs/moments/ROADMAP.md, этап 6 — Weekly-rank "в понедельник". Устройство
// знает local-день пользователя, сервер — нет (тот же приём, что
// TodayEveningGate для "после 18:00"): проверка целиком клиентская, только
// после гидрации (ref-гвард вместо эффекта с пустым deps — страхует от
// повторного пуша при HMR/remount в деве, не только от двойного mount).
export default function WeeklyRankGate() {
  const { pushMoments } = useMoments();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (new Date().getDay() !== 1) return; // 1 = понедельник
    fired.current = true;
    void fetchWeeklyRankMomentAction().then((moment) => {
      if (moment) pushMoments([moment]);
    });
  }, [pushMoments]);

  return null;
}
