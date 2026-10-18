"use client";

import { Button } from "@/components/ui/button";
import type { PerfectWeekMoment } from "@/lib/moments/types";
import { Confetti } from "../confetti";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Perfect-week.dc.html, reference/Perfect-week.png.
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function PerfectWeekScreen({ moment, onClose }: { moment: PerfectWeekMoment; onClose: () => void }) {
  const xp = useCountUp(moment.xpAwarded, { delay: 2400, duration: 700 });

  return (
    <MomentScreen
      title="Идеальная неделя"
      onClose={onClose}
      footerDelay={2.6}
      footer={
        <Button
          className="mo-cta"
          onClick={onClose}
          style={{ ["--btn-fill" as string]: "var(--ember-text)", ["--btn-edge" as string]: "#9a330a", ["--btn-label" as string]: "#fff" }}
        >
          Новая неделя, вперёд
        </Button>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 96 }}>
        <div style={{ position: "relative", display: "inline-block", width: 230, height: 230 }}>
          <div className="mo-halo" style={{ position: "absolute", inset: 0 }}>
            <svg className="mo-spin" viewBox="0 0 230 230" width="230" height="230" aria-hidden="true" style={{ animationDuration: "10s" }}>
              <circle cx="115" cy="115" r="100" fill="none" stroke="var(--sun)" strokeWidth="12" strokeDasharray="20 14" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ position: "absolute", inset: 30, borderRadius: 999, background: "var(--sun-tint)" }} />
          <div className="mo-flick" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width="130" height="130" aria-hidden="true">
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
              <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
            </svg>
          </div>
          <Confetti seed={41} count={24} delay={2.1} reach={[120, 100]} fall={0} style={{ left: "50%", top: "50%" }} />
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "18px 24px 0", fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: "2s" }}>
          Идеальная неделя!
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 30px 0", fontSize: 16, animationDelay: "2.1s" }}>
          7 дней из 7, ни одной заморозки
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "26px 20px 0", padding: 16, animationDelay: "0.5s" }}>
        <div style={{ position: "relative", height: 40, borderRadius: 99, background: "var(--surface-muted)", overflow: "hidden" }}>
          <div className="mo-growbar" style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99, background: "var(--ember)", boxShadow: "inset 0 -5px 0 0 var(--ember-edge)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", textAlign: "center", fontSize: 12, fontWeight: 700, marginTop: 8 }}>
          {DAYS.map((d, i) => (
            <span key={d} className="mo-lit" style={{ animationDelay: `${0.8 + i * 0.2}s` }}>
              {d}
            </span>
          ))}
        </div>
      </div>

      <div className="mo-rise" style={{ margin: "12px 20px 0", borderRadius: 18, background: "var(--sun-tint)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, animationDelay: "2.3s" }}>
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--sun)" stroke="var(--sun-edge)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--sun-text)" }}>+{xp} XP за идеальную неделю</div>
      </div>
    </MomentScreen>
  );
}
