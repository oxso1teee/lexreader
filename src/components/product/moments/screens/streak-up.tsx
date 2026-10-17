"use client";

import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { StreakUpMoment } from "@/lib/moments/types";
import { MomentScreen, WEEKDAYS_RU } from "../moment-screen";

// Эталон: docs/moments/mockups/Streak-up.dc.html, reference/Streak-up.png.

function embers(): CSSProperties[] {
  let s = 21;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: 10 }, (_, i) => ({
    background: i % 2 ? "var(--sun)" : "var(--ember)",
    ["--dx" as string]: `${Math.round(r() * 120 - 60)}px`,
    ["--d" as string]: `${(1.2 + r() * 2).toFixed(2)}s`,
    ["--t" as string]: `${(1.4 + r() * 1).toFixed(2)}s`,
    marginLeft: Math.round(r() * 60 - 30),
  }) as CSSProperties);
}
const EMBERS = embers();

function daysWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день подряд";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня подряд";
  return "дней подряд";
}

export function StreakUpScreen({
  moment,
  onClose,
  onNudge,
}: {
  moment: StreakUpMoment;
  onClose: () => void;
  onNudge?: () => void;
}) {
  const [sent, setSent] = useState(false);
  const { streak, friend } = moment;

  return (
    <MomentScreen
      title={`Стрик ${streak} ${daysWord(streak)}`}
      onClose={onClose}
      footerDelay={1.9}
      footer={
        <Button variant="ember" className="mo-cta" onClick={onClose} style={{ ["--btn-fill" as string]: "#c2410c", ["--btn-edge" as string]: "#9a330a", ["--btn-label" as string]: "#fff" }}>
          Продолжить
        </Button>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 86 }}>
        <div style={{ position: "relative", display: "inline-block", width: 220, height: 200 }}>
          <div className="mo-glow mo-glow-ember" aria-hidden="true" style={{ position: "absolute", left: 20, top: 30, width: 180, height: 180, borderRadius: 999 }} />
          {EMBERS.map((st, i) => (
            <span key={i} className="mo-em" style={st} aria-hidden="true" />
          ))}
          <div className="mo-ignite" style={{ position: "absolute", left: 15, top: 5 }}>
            <div className="mo-flick">
              <svg viewBox="0 0 24 24" width="190" height="190" aria-hidden="true">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
                <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
              </svg>
            </div>
          </div>
        </div>
        <div style={{ height: 104, overflow: "hidden", marginTop: -4 }} aria-label={`${streak} ${daysWord(streak)}`}>
          <div className="mo-roll" aria-hidden="true">
            <div className="mo-disp" style={{ fontSize: 92, fontWeight: 900, lineHeight: "104px", color: "var(--border-strong)" }}>
              {Math.max(0, streak - 1)}
            </div>
            <div className="mo-disp" style={{ fontSize: 92, fontWeight: 900, lineHeight: "104px", color: "var(--ember-text)" }}>
              {streak}
            </div>
          </div>
        </div>
        <div className="mo-disp mo-rise" style={{ fontSize: 22, fontWeight: 700, color: "var(--ember-text)", animationDelay: "1.2s" }}>
          {daysWord(streak)}
        </div>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "24px 20px 0", padding: "14px 16px", animationDelay: "0.8s" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, textAlign: "center", fontSize: 12, fontWeight: 600 }}>
          {moment.week.map((mark, i) => (
            <div key={i}>
              <div
                className={mark === "today" ? "mo-day mo-day-today" : "mo-day"}
                style={
                  mark === "today"
                    ? undefined
                    : { background: mark === "done" ? "var(--ember)" : mark === "freeze" ? "var(--sky)" : "var(--surface-muted)" }
                }
              />
              <div className={mark === "today" ? undefined : "mo-muted"} style={{ marginTop: 4, ...(mark === "today" ? { color: "var(--ember-text)", fontWeight: 700 } : {}) }}>
                {WEEKDAYS_RU[i]}
              </div>
            </div>
          ))}
        </div>
        <div className="mo-muted" style={{ fontSize: 14, marginTop: 12, textAlign: "center" }}>
          Позанимайся завтра, и станет {streak + 1}
        </div>
      </div>

      {friend && (
        <div className="mo-card mo-rise" style={{ margin: "12px 20px 0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, animationDelay: "1.4s" }}>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: "#8b5cf6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flex: "none" }}>
            {friend.initial}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{friend.name} ещё не занимается сегодня</div>
            <div className="mo-muted" style={{ fontSize: 13 }}>
              Общая серия: {friend.sharedStreak} {daysWord(friend.sharedStreak).replace(" подряд", "")}
            </div>
          </div>
          {onNudge && (
            <button
              type="button"
              className={sent ? "mo-nudge mo-sentpop" : "mo-nudge"}
              disabled={sent}
              onClick={() => {
                setSent(true);
                onNudge();
              }}
              style={
                sent
                  ? { background: "var(--leaf-tint)", color: "var(--leaf-text)" }
                  : { background: "var(--ember-tint)", color: "var(--ember-text)", boxShadow: "inset 0 -3px 0 0 #ffd9a3" }
              }
            >
              {sent ? "Напомнили" : "Напомнить"}
            </button>
          )}
        </div>
      )}
    </MomentScreen>
  );
}
