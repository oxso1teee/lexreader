"use client";

import { Button } from "@/components/ui/button";
import type { GoalDoneMoment } from "@/lib/moments/types";
import { Confetti } from "../confetti";
import { MomentScreen, WEEKDAYS_RU } from "../moment-screen";
import { useCountUp, useProgress } from "../use-count-up";

// Эталон: docs/moments/mockups/Goal-done.dc.html, reference/Goal-done.png.
const R1 = 90;
const R2 = 96;
const C1 = 2 * Math.PI * R1;
const C2 = 2 * Math.PI * R2;

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function GoalDoneScreen({ moment, onClose }: { moment: GoalDoneMoment; onClose: () => void }) {
  const p = useProgress({ delay: 200, duration: 1300 });
  const xp = useCountUp(moment.xpToday, { delay: 200, duration: 1300 });
  const doneDays = moment.week.filter((d) => d === "done" || d === "today").length;
  const daysSoFar = moment.week.findIndex((d) => d === "today") + 1 || doneDays;

  return (
    <MomentScreen
      title="Цель дня выполнена"
      onClose={onClose}
      footerDelay={2.4}
      footer={
        <Button className="mo-cta" onClick={onClose}>
          Продолжить
        </Button>
      }
    >
      <div style={{ position: "relative", height: 330, marginTop: 70, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Confetti seed={9} delay={1.5} style={{ left: "50%", top: "50%" }} />
        <div className="mo-ringpulse" style={{ animationDelay: "1.55s" }}>
          <svg viewBox="0 0 220 220" width="240" height="240" role="img" aria-label={`Цель дня: ${moment.xpToday} из ${moment.xpGoal} XP`}>
            <circle cx="110" cy="110" r={R1} fill="none" stroke="var(--sun-tint)" strokeWidth="22" />
            <circle
              cx="110"
              cy="110"
              r={R1}
              fill="none"
              stroke="var(--sun)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray={C1}
              strokeDashoffset={C1 * (1 - p)}
              transform="rotate(-90 110 110)"
            />
            <circle
              cx="110"
              cy="110"
              r={R2}
              fill="none"
              stroke="rgba(255,255,255,.5)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C2}
              strokeDashoffset={C2 * (1 - p)}
              transform="rotate(-90 110 110)"
            />
          </svg>
        </div>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div
            className="mo-pop"
            style={{
              animationDelay: "1.55s",
              width: 64,
              height: 64,
              borderRadius: 999,
              background: "var(--leaf)",
              boxShadow: "inset 0 -5px 0 0 var(--leaf-edge)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" style={{ fill: "none", stroke: "#fff", strokeWidth: 3.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path className="mo-check" style={{ animationDelay: "1.75s" }} d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <div className="mo-disp" style={{ fontSize: 26, fontWeight: 900, marginTop: 8, color: "var(--sun-text)" }}>
            {xp}/{moment.xpGoal}
          </div>
          <div className="mo-muted" style={{ fontSize: 13, fontWeight: 600 }}>
            XP сегодня
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 28px" }}>
        <h2 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: "1.6s" }}>
          Цель дня выполнена!
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 0 0", fontSize: 16, animationDelay: "1.75s" }}>
          Завтра цель та же: {moment.xpGoal} XP, около {moment.minutesHint} минут
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "24px 20px 0", padding: "14px 16px", animationDelay: "1.9s" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Цель выполнена {doneDays} {plural(doneDays, "день", "дня", "дней")} из {daysSoFar} на этой неделе
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginTop: 12 }}>
          {moment.week.map((mark, i) => {
            const today = mark === "today";
            const done = mark === "done" || today;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                {done ? (
                  <svg className="mo-dpop" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" style={{ animationDelay: `${today ? 2.4 : 2.05 + i * 0.08}s` }}>
                    <circle cx="12" cy="12" r={today ? 11 : 10} fill={today ? "var(--ember)" : "var(--sun)"} />
                    <path d="M7.5 12l3 3 6-6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="var(--surface-muted)" strokeWidth="3" />
                  </svg>
                )}
                <span className={today ? undefined : "mo-muted"} style={today ? { color: "var(--sun-text)", fontWeight: 700 } : undefined}>
                  {WEEKDAYS_RU[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </MomentScreen>
  );
}
