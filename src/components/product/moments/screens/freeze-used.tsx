"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { FreezeUsedMoment } from "@/lib/moments/types";
import { MomentScreen, WEEKDAYS_RU } from "../moment-screen";

// Эталон: docs/moments/mockups/Freeze-used.dc.html, reference/Freeze-used.png.
function snow(): { size: number; style: CSSProperties }[] {
  let s = 51;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: 12 }, () => {
    const w = 10 + Math.round(r() * 10);
    return {
      size: w,
      style: {
        left: Math.round(r() * 370),
        opacity: Number((0.5 + r() * 0.5).toFixed(2)),
        ["--dx" as string]: `${Math.round(r() * 60 - 30)}px`,
        ["--t" as string]: `${(6 + r() * 5).toFixed(2)}s`,
        ["--d" as string]: `${(-r() * 8).toFixed(2)}s`,
      } as CSSProperties,
    };
  });
}
const SNOW = snow();

export function FreezeUsedScreen({ moment, onClose }: { moment: FreezeUsedMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title="Заморозка спасла стрик"
      background="var(--sky-tint)"
      onClose={onClose}
      footerDelay={1.5}
      footer={
        <Button
          className="mo-cta"
          onClick={onClose}
          // Белый на --sky-edge даёт только 3.40:1 (axe-core,
          // e2e/unified-shell-a11y.spec.ts) — тёмный текст даёт 5.11:1.
          style={{ ["--btn-fill" as string]: "var(--sky-edge)", ["--btn-edge" as string]: "#075a85", ["--btn-label" as string]: "#1a1a1a" }}
        >
          Продолжить серию сегодня
        </Button>
      }
    >
      {SNOW.map((p, i) => (
        <svg key={i} className="mo-snow" viewBox="0 0 24 24" width={p.size} height={p.size} style={p.style} aria-hidden="true">
          <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ))}

      <div style={{ position: "relative", textAlign: "center", paddingTop: 130 }}>
        <div className="mo-freezein" style={{ display: "inline-block" }}>
          <div className="mo-float" style={{ position: "relative", width: 180, height: 180 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 36, background: "rgba(255,255,255,.6)", border: "4px solid #fff", boxShadow: "inset 0 -12px 0 0 rgba(28,176,246,.35), inset 0 0 0 10px rgba(255,255,255,.35)", overflow: "hidden" }}>
              <span className="mo-shimmer" aria-hidden="true" />
            </div>
            <div style={{ position: "absolute", left: 22, top: 18, width: 40, height: 10, borderRadius: 99, background: "#fff", transform: "rotate(-20deg)" }} />
            <div style={{ position: "absolute", right: 26, bottom: 22, width: 18, height: 6, borderRadius: 99, background: "#fff", transform: "rotate(-20deg)" }} />
            <div className="mo-breathe" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="118" height="118" aria-hidden="true">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
                <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
              </svg>
            </div>
          </div>
        </div>
        {/* --sky-edge давал 2.99:1 (на грани даже для крупного текста,
            порог 3:1) — --sky-text даёт 4.22:1, тот же синий, с запасом. */}
        <h2 className="mo-disp mo-rise" style={{ margin: "30px 24px 0", fontSize: 26, lineHeight: 1.2, fontWeight: 900, color: "var(--sky-text)", animationDelay: "0.5s" }}>
          Заморозка спасла стрик
        </h2>
        <p className="mo-rise" style={{ margin: "12px 30px 0", fontSize: 16, lineHeight: 1.45, animationDelay: "0.62s" }}>
          Вчера ты не занимался, но серия <b>{moment.streak} дней</b> цела.
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ position: "relative", margin: "26px 20px 0", padding: "14px 16px", animationDelay: "0.8s" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, textAlign: "center", fontSize: 12, fontWeight: 600 }}>
          {moment.week.map((mark, i) => {
            const isFreeze = mark === "freeze";
            const isToday = mark === "today";
            return (
              <div key={i}>
                <div
                  className={isFreeze ? "mo-day mo-flake" : "mo-day"}
                  style={{
                    height: 40,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isFreeze ? "var(--sky)" : mark === "done" ? "var(--ember)" : isToday ? "#fff" : "var(--surface-muted)",
                    border: isToday ? "2px dashed var(--ember)" : undefined,
                    color: isFreeze ? "#fff" : undefined,
                  }}
                >
                  {isFreeze && (
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div
                  className={isFreeze || isToday ? undefined : "mo-muted"}
                  style={{ marginTop: 4, color: isFreeze ? "var(--sky-text)" : isToday ? "var(--ember-text)" : undefined, fontWeight: isFreeze || isToday ? 700 : undefined }}
                >
                  {WEEKDAYS_RU[i]}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 14, marginTop: 12, textAlign: "center" }}>
          Заморозок осталось: <b>0</b>. Новая придёт в понедельник
        </div>
      </div>
    </MomentScreen>
  );
}
