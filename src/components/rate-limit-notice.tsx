"use client";

import { useEffect, useRef, useState } from "react";
import { formatRetryLabel } from "@/lib/rate-limit-format";

// Раньше "Слишком много попыток — попробуй позже" — без срока ожидания,
// без отключения кнопки, обычный <p> без aria-live. Пользователь не знал,
// сколько ждать, и мог долбить сабмит дальше. aria-atomic озвучивает всю
// фразу целиком при каждом тике — тредофф в пользу простоты; для короткого
// (обычно единицы минут) countdown это принятая практика, не идеальная с
// точки зрения частоты объявлений, но не оставляющая пользователя в тишине.
// Родитель обязан передавать key={retryAfterSeconds} (или другой ключ,
// меняющийся при каждой новой блокировке) — это пересоздаёт компонент и его
// countdown-состояние заново вместо синхронизации через эффект.
export default function RateLimitNotice({
  message,
  retryAfterSeconds,
  onExpire,
}: {
  message: string;
  retryAfterSeconds: number;
  onExpire?: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire?.();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, onExpire]);

  if (secondsLeft <= 0) return null;

  const timeLabel = formatRetryLabel(secondsLeft);

  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="text-sm text-red-600 outline-none dark:text-red-400"
    >
      {message} Попробуй снова через {timeLabel}.
    </p>
  );
}
