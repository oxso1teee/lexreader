"use client";

import { useCallback, useEffect, useState } from "react";

// Обратный отсчёт в секундах («Отправить ещё раз через 0:42»). Считается от
// КОНЦА отсчёта по настенным часам, а не счётчиком тиков: таймеры в фоновой
// вкладке троттлятся (человек ушёл в почту за ссылкой и вернулся), и счётчик
// показывал бы устаревшее время. Тик раз в секунду только перерисовывает;
// при возврате на вкладку время пересчитывается сразу. restart() запускает
// отсчёт заново — например, после повторной отправки письма.
export function useCountdown(initialSeconds: number) {
  // endsAt и now берутся из ОДНОГО вызова Date.now(): на первом рендере разность
  // ровно initialSeconds и на сервере, и на клиенте — расхождения гидратации нет.
  const [clock, setClock] = useState(() => {
    const start = Date.now();
    return { endsAt: start + initialSeconds * 1000, now: start };
  });
  const secondsLeft = Math.max(0, Math.ceil((clock.endsAt - clock.now) / 1000));
  const running = secondsLeft > 0;

  useEffect(() => {
    if (!running) return;
    const sync = () => setClock((current) => ({ ...current, now: Date.now() }));
    const id = setInterval(sync, 1000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [running]);

  const restart = useCallback(
    (seconds: number = initialSeconds) => {
      const start = Date.now();
      setClock({ endsAt: start + seconds * 1000, now: start });
    },
    [initialSeconds],
  );

  return { secondsLeft, restart };
}
