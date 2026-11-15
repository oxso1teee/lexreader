"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

// docs/moments/mockups/Double-XP.dc.html, reference/Double-XP.png. boostUntil
// — реальный profiles.xp_boost_until (ISO), не декоративный таймер: кольцо
// и mm:ss честно считаются от него, не от фиксированных 15 минут вперёд
// (на случай, если экран открыли не сразу после Chest).
const CIRCUMFERENCE = 829;

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function DoubleXpScreen({ boostUntil, reviewHref }: { boostUntil: string; reviewHref: string }) {
  const until = new Date(boostUntil).getTime();
  const totalMs = useState(() => Math.max(1, until - Date.now()))[0];
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, until - Date.now()));

  useEffect(() => {
    const iv = setInterval(() => {
      setRemainingMs(Math.max(0, until - Date.now()));
    }, 1000);
    return () => clearInterval(iv);
  }, [until]);

  const ringOffset = Math.round(CIRCUMFERENCE * (1 - remainingMs / totalMs));

  return (
    <div className="mo-screen" style={{ background: "var(--leaf)", color: "#fff" }} role="dialog" aria-modal="true" aria-label="Двойной опыт включён">
      <div className="mo-column">
        <div style={{ position: "relative", height: 340, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
          <svg
            viewBox="0 0 280 280"
            width="280"
            height="280"
            aria-hidden="true"
            style={{ position: "absolute", left: "50%", top: "50%", margin: "-110px 0 0 -140px", transform: "rotate(-90deg)" }}
          >
            <circle cx="140" cy="140" r="132" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="8" />
            <circle
              cx="140"
              cy="140"
              r="132"
              fill="none"
              stroke="#ffc700"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div
            className="mo-slam"
            style={{
              position: "relative",
              width: 200,
              height: 200,
              borderRadius: 999,
              background: "#ffc700",
              boxShadow: "inset 0 -10px 0 0 #e0a500, 0 0 0 10px rgba(255,199,0,.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1a1a1a",
            }}
          >
            <div className="mo-disp" style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em" }}>×2</div>
          </div>
        </div>

        <div style={{ position: "relative", textAlign: "center", padding: "0 28px" }}>
          <h1 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 900 }}>Двойной опыт включён</h1>
          <div
            className="mo-rise"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 20, padding: "12px 18px", borderRadius: 16, background: "rgba(0,0,0,.2)" }}
            role="timer"
            aria-label={`Осталось ${formatTime(remainingMs)}`}
          >
            <span className="mo-disp" style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: "tabular-nums", minWidth: 90, textAlign: "left" }}>
              {formatTime(remainingMs)}
            </span>
          </div>
        </div>

        <div className="mo-footer">
          <ButtonLink href={reviewHref} variant="sun" className="mo-cta">
            Начать занятие
          </ButtonLink>
          <Link
            href="/home"
            style={{ display: "block", textAlign: "center", font: "600 15px/1 var(--font-onest), sans-serif", color: "#fff", padding: "16px 0 0", textDecoration: "underline" }}
          >
            Позже
          </Link>
        </div>
      </div>
    </div>
  );
}
