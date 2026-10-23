"use client";

import { useEffect, useState, type CSSProperties } from "react";
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

// Молнии, разлетающиеся из ×2 (макет: bolts с --dx/--dy/--r/--d).
const BOLTS: CSSProperties[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + 0.3;
  return {
    margin: "-13px 0 0 -13px",
    ["--dx" as string]: `${Math.round(Math.cos(a) * 170)}px`,
    ["--dy" as string]: `${Math.round(Math.sin(a) * 170)}px`,
    ["--r" as string]: `${(i % 2 ? 1 : -1) * (40 + i * 10)}deg`,
    ["--d" as string]: `${(0.3 + (i % 4) * 0.08).toFixed(2)}s`,
  } as CSSProperties;
});

// Сколько XP даёт дочитанная глава (finishReading в read/[textId]/actions.ts).
const CHAPTER_XP = 10;

export function DoubleXpScreen({ boostUntil, reviewHref }: { boostUntil: string; reviewHref: string }) {
  const until = new Date(boostUntil).getTime();
  // null до монтирования: сервер и клиент рендерят одинаково, время
  // считается только в браузере (Date.now() в рендере ломал гидрацию).
  const [timing, setTiming] = useState<{ total: number; left: number } | null>(null);

  useEffect(() => {
    const total = Math.max(1, until - Date.now());
    const tick = () => setTiming({ total, left: Math.max(0, until - Date.now()) });
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [until]);

  const ringOffset = timing ? Math.round(CIRCUMFERENCE * (1 - timing.left / timing.total)) : 0;
  const time = timing ? formatTime(timing.left) : "--:--";

  return (
    <div className="mo-screen" style={{ background: "var(--leaf)", color: "#fff", overflow: "hidden" }} role="dialog" aria-modal="true" aria-label="Двойной опыт включён">
      <div aria-hidden="true" style={{ position: "absolute", width: 460, height: 460, borderRadius: 999, background: "var(--leaf-edge)", opacity: 0.5, left: "50%", marginLeft: -230, top: 40 }} />
      <div className="mo-column">
        <div style={{ position: "relative", height: 400, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
          {BOLTS.map((b, i) => (
            <svg key={i} className="dx-bt" viewBox="0 0 24 24" width="26" height="26" style={b} aria-hidden="true">
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--sun)" />
            </svg>
          ))}
          <svg viewBox="0 0 280 280" width="280" height="280" aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", margin: "-120px 0 0 -140px", transform: "rotate(-90deg)" }}>
            <circle cx="140" cy="140" r="132" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="8" />
            <circle cx="140" cy="140" r="132" fill="none" stroke="var(--sun)" strokeWidth="8" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={ringOffset} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <svg className="dx-spinslow" viewBox="0 0 300 300" width="300" height="300" aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", margin: "-130px 0 0 -150px", opacity: 0.25 }}>
            <circle cx="150" cy="150" r="148" fill="none" stroke="var(--sun-tint)" strokeWidth="3" strokeDasharray="3 16" strokeLinecap="round" />
          </svg>
          <div className="dx-slam" style={{ position: "relative", width: 230, height: 230, borderRadius: 999, background: "var(--sun)", boxShadow: "inset 0 -10px 0 0 var(--sun-edge), 0 0 0 10px rgba(255,199,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1a1a" }}>
            <svg className="dx-zap" viewBox="0 0 24 24" width="70" height="70" aria-hidden="true" style={{ position: "absolute", top: 22, right: 26 }}>
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#fff" stroke="var(--sun-text)" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <div className="mo-disp" style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em" }}>×2</div>
          </div>
        </div>

        <div style={{ position: "relative", textAlign: "center", padding: "0 28px" }}>
          <h1 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: ".6s" }}>
            Двойной опыт включён
          </h1>
          <div className="mo-rise" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14, animationDelay: ".7s" }}>
            <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.9 }}>За главу</span>
            <span className="mo-disp" style={{ position: "relative", fontSize: 20, fontWeight: 900, opacity: 0.7 }}>
              {CHAPTER_XP} XP
              <span className="dx-strike" aria-hidden="true" />
            </span>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ fill: "none", stroke: "#fff", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="mo-disp dx-xpup" style={{ fontSize: 24, fontWeight: 900, color: "var(--sun)" }}>{CHAPTER_XP * 2} XP</span>
          </div>
          <div
            className="mo-rise"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 20, padding: "12px 18px", borderRadius: 16, background: "rgba(0,0,0,.2)", animationDelay: ".85s" }}
            role="timer"
            aria-label={`Осталось ${time}`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style={{ fill: "none", stroke: "var(--sun)", strokeWidth: 2.4, strokeLinecap: "round" }}>
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l3 2M9 2h6" />
            </svg>
            <span className="mo-disp" style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: "tabular-nums", minWidth: 98, textAlign: "left" }}>{time}</span>
          </div>
        </div>

        <div className="mo-footer mo-rise" style={{ marginTop: "auto", animationDelay: "1.1s" }}>
          <ButtonLink href={reviewHref} variant="sun" className="mo-cta">
            Начать занятие
          </ButtonLink>
          <Link href="/home" style={{ display: "block", textAlign: "center", font: "600 15px/1 var(--font-onest), sans-serif", color: "#fff", padding: "16px 0 0", textDecoration: "underline" }}>
            Позже
          </Link>
        </div>
      </div>
    </div>
  );
}
