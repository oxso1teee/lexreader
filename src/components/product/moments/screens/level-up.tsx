"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { LevelUpMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Level-up.dc.html, reference/Level-up.png.
// Разблокированная подборка из макета убрана — у приложения нет механики
// открытия контента по уровню (ничего настоящего показать нечего, см. правило
// "данные только настоящие" в AGENTS.md).
function stars(): CSSProperties[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return {
      ["--dx" as string]: `${Math.round(Math.cos(a) * 150)}px`,
      ["--dy" as string]: `${Math.round(Math.sin(a) * 150)}px`,
      ["--d" as string]: `${(1.6 + (i % 3) * 0.05).toFixed(2)}s`,
      margin: "-9px 0 0 -9px",
    } as CSSProperties;
  });
}
const STARS = stars();

export function LevelUpScreen({ moment, onClose }: { moment: LevelUpMoment; onClose: () => void }) {
  const total = useCountUp(moment.totalXp, { delay: 1700, duration: 900 });
  const barPct = useCountUp(Math.round((moment.xpIntoLevel / moment.xpForNextLevel) * 100), { delay: 2300, duration: 800 });
  const remaining = moment.xpForNextLevel - moment.xpIntoLevel;

  return (
    <MomentScreen
      title={`Новый уровень: ${moment.level}`}
      background="var(--leaf-deep)"
      foreground="#fff"
      onClose={onClose}
      footerDelay={2.6}
      footer={
        <Button
          className="mo-cta"
          onClick={onClose}
          style={{ ["--btn-fill" as string]: "var(--sun)", ["--btn-edge" as string]: "var(--sun-edge)", ["--btn-label" as string]: "#1a1a1a" }}
        >
          Отлично
        </Button>
      }
    >
      <div
        aria-hidden="true"
        className="mo-glowpulse"
        style={{ position: "absolute", left: "50%", top: 116, width: 280, height: 280, marginLeft: -140, borderRadius: 999, background: "var(--leaf)" }}
      />

      <div
        className="mo-rise"
        style={{
          position: "relative",
          textAlign: "center",
          paddingTop: 70,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--sun)",
        }}
      >
        Новый уровень
      </div>

      <div style={{ position: "relative", height: 300, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
        <span
          aria-hidden="true"
          className="mo-wave-lg"
          style={{ position: "absolute", left: "50%", top: "50%", width: 200, height: 200, margin: "-100px 0 0 -100px", borderRadius: 999, border: "5px solid var(--sun)" }}
        />
        {STARS.map((s, i) => (
          <svg key={i} className="mo-star" viewBox="0 0 24 24" width="18" height="18" style={{ position: "absolute", left: "50%", top: "50%", ...s }} aria-hidden="true">
            <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--sun)" />
          </svg>
        ))}
        <div className="mo-zoom" style={{ position: "relative", width: 220, height: 220 }}>
          <svg viewBox="0 0 220 220" width="220" height="220" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
            <circle cx="110" cy="110" r="100" fill="var(--leaf)" stroke="var(--sun)" strokeWidth="10" />
            <circle cx="110" cy="110" r="82" fill="var(--leaf-deep)" />
            <circle cx="110" cy="110" r="100" fill="none" stroke="var(--leaf-tint-strong)" strokeWidth="4" strokeDasharray="4 12" strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".1em", color: "var(--leaf-tint-strong)" }}>УРОВЕНЬ</div>
            <div style={{ height: 100, overflow: "hidden" }} aria-label={`Уровень ${moment.level}`}>
              <div className="mo-lvlroll" aria-hidden="true">
                <div className="mo-disp" style={{ fontSize: 88, fontWeight: 900, lineHeight: "100px", color: "var(--leaf-tint-strong)", textAlign: "center" }}>
                  {moment.level - 1}
                </div>
                <div className="mo-disp" style={{ fontSize: 88, fontWeight: 900, lineHeight: "100px", color: "var(--sun)", textAlign: "center" }}>
                  {moment.level}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", textAlign: "center", padding: "0 28px" }}>
        <h2 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: "1.7s" }}>
          Ты на {moment.level} уровне!
        </h2>
        <p className="mo-rise" style={{ margin: "10px 0 0", fontSize: 16, opacity: 0.9, animationDelay: "1.8s" }}>
          {total.toLocaleString("ru-RU")} XP за всё время
        </p>
        <div className="mo-rise" style={{ margin: "14px 10px 0", animationDelay: "1.9s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
            <span>Ур. {moment.level}</span>
            <span>ещё {remaining} XP до {moment.level + 1}</span>
          </div>
          <div style={{ height: 14, borderRadius: 99, background: "rgba(255,255,255,.14)", marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${barPct}%`, borderRadius: 99, background: "var(--sun)", boxShadow: "inset 0 -4px 0 0 var(--sun-edge)" }} />
          </div>
        </div>
      </div>
    </MomentScreen>
  );
}
