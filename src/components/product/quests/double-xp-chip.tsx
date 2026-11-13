"use client";

import { useEffect, useState } from "react";

// docs/moments/ROADMAP.md, этап 5 — "чип на главной, пока буст активен".
// boostUntil приходит с сервера (profiles.xp_boost_until); чип сам снимает
// себя, когда время истекает, без перезагрузки страницы.
function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function DoubleXpChip({ boostUntil }: { boostUntil: string | null }) {
  const until = boostUntil ? new Date(boostUntil).getTime() : null;
  const [remainingMs, setRemainingMs] = useState(() => (until ? Math.max(0, until - Date.now()) : 0));

  useEffect(() => {
    if (!until) return;
    const iv = setInterval(() => setRemainingMs(Math.max(0, until - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [until]);

  if (!until || remainingMs <= 0) return null;

  return (
    <span
      className="mo-disp"
      role="timer"
      aria-label={`Двойной опыт, осталось ${formatTime(remainingMs)}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--sun)",
        color: "#1a1a1a",
        fontWeight: 900,
        fontSize: 13,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      ×2 · {formatTime(remainingMs)}
    </span>
  );
}
