"use client";

import { useEffect } from "react";
import { syncTimezoneAction } from "@/app/(app)/actions";

// Часовой пояс браузера → profiles.timezone. От него зависит, когда для пользователя
// «меняется день» (цель, серия, задания). Сверка идёт при открытии приложения; на
// сервер уходит только если пояс отличается от сохранённого, и не чаще раза за
// вкладку — переезд или поездка подхватываются при следующем визите.
export default function TimezoneSync({ current }: { current: string | null }) {
  useEffect(() => {
    let detected: string | undefined;
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!detected || detected === current) return;
    try {
      if (sessionStorage.getItem("lexreader:tz-synced") === detected) return;
      sessionStorage.setItem("lexreader:tz-synced", detected);
    } catch {
      // sessionStorage недоступен — отправим; сервер всё равно пишет только при отличии
    }
    void syncTimezoneAction(detected);
  }, [current]);
  return null;
}
