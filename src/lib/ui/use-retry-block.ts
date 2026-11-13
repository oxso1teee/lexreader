"use client";

import { useState } from "react";

// Блокировка формы по rate limit: включается, когда сервер вернул
// retryAfterSeconds, снимается по окончании отсчёта (onExpire у
// RateLimitNotice). «Adjusting state when a prop changes» (react.dev) —
// сравнение в теле рендера вместо useEffect, чтобы не ловить
// set-state-in-effect и не терять кадр на лишний ререндер.
//
// Пример:
//   const [blocked, unblock] = useRetryBlock(state.retryAfterSeconds);
//   {blocked && <RateLimitNotice … onExpire={unblock} />}
export function useRetryBlock(retryAfterSeconds: number | undefined) {
  const [blocked, setBlocked] = useState(false);
  const [previous, setPrevious] = useState(retryAfterSeconds);
  if (retryAfterSeconds !== previous) {
    setPrevious(retryAfterSeconds);
    setBlocked(Boolean(retryAfterSeconds));
  }
  return [blocked && Boolean(retryAfterSeconds), () => setBlocked(false)] as const;
}
