"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FriendStreakMoment } from "@/lib/moments/types";
import { remindFriendAction } from "@/app/(app)/friends/actions";
import { Confetti } from "../confetti";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Friend-streak.dc.html, reference/Friend-streak.png.
// Кнопка в макете — "Позвать" (не "Напомнить"): follow текст макета буквально.
// "Позвать" шлёт push-напоминание тому партнёру, что указан в title
// (moment.friendName) — первая строка partners[].
function daysWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}

export function FriendStreakScreen({ moment, onClose }: { moment: FriendStreakMoment; onClose: () => void }) {
  const n = useCountUp(moment.sharedStreak, { delay: 900, duration: 900 });
  const [invited, setInvited] = useState(false);
  const primaryPartner = moment.partners[0];

  async function handleInvite() {
    if (!primaryPartner) return;
    setInvited(true);
    await remindFriendAction(primaryPartner.id);
  }

  return (
    <MomentScreen
      title={`${moment.sharedStreak} дней вместе: ты и ${moment.friendName}`}
      onClose={onClose}
      footerDelay={1.6}
      footer={
        <div style={{ display: "flex", gap: 12 }}>
          <Button
            disabled={invited || !primaryPartner}
            onClick={handleInvite}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "var(--surface-muted)", ["--btn-edge" as string]: "#c9c2b6", ["--btn-label" as string]: "var(--foreground)", flex: "0 0 auto", width: "auto", paddingLeft: 16, paddingRight: 16 }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <circle cx="9" cy="8" r="4" />
              <path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" />
            </svg>
            {invited ? "Позвали" : "Позвать"}
          </Button>
          <Button className="mo-cta" onClick={onClose} style={{ ["--btn-fill" as string]: "#c2410c", ["--btn-edge" as string]: "#9a330a", ["--btn-label" as string]: "#fff", flex: 1 }}>
            Так держать
          </Button>
        </div>
      }
    >
      {/* Эталон: docs/moments/mockups/Friend-streak.dc.html — два аватара
          въезжают с боков, между ними вспыхивает огонь, число дней, список. */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", paddingTop: 120, height: 300 }}>
        <Confetti seed={61} count={26} delay={0.6} reach={[110, 110]} fall={0} colors={["var(--ember)", "var(--sun)", "#8b5cf6", "#0b79b0", "var(--leaf)"]} style={{ left: "50%", top: 175 }} />
        <div className="fs-inL"><div className="fs-av" style={{ background: "#0b79b0" }}>Ты</div></div>
        <div className="fs-ignite" style={{ margin: "0 -14px", position: "relative", zIndex: 2 }}>
          <div className="mo-flick">
            <svg viewBox="0 0 24 24" width="92" height="92" aria-hidden="true">
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" stroke="#fff" strokeWidth="1.2" />
              <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
            </svg>
          </div>
        </div>
        <div className="fs-inR"><div className="fs-av" style={{ background: "#8b5cf6" }}>{primaryPartner?.initial ?? "?"}</div></div>
      </div>

      <div style={{ textAlign: "center", padding: "0 28px" }}>
        <div className="mo-disp mo-rise" style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: "var(--ember-text)", animationDelay: ".9s", fontVariantNumeric: "tabular-nums" }} aria-hidden="true">
          {n}
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "6px 0 0", fontSize: 22, lineHeight: 1.2, fontWeight: 900, animationDelay: "1s" }}>
          {daysWord(moment.sharedStreak)} вместе: ты и {moment.friendName}
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 0 0", fontSize: 15, animationDelay: "1.1s" }}>
          Каждый занимается сам, серия общая. Пропустит один, сгорит у обоих
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "22px 20px 0", padding: "4px 16px", animationDelay: "1.3s" }}>
        {moment.partners.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i > 0 ? "2px solid var(--surface-muted)" : undefined }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: i === 0 ? "#8b5cf6" : "#0b79b0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px/1 var(--font-onest), sans-serif", flex: "none" }}>
              {p.initial}
            </span>
            <b style={{ flex: 1 }}>{p.name}</b>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: "var(--ember-text)" }}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
              </svg>
              {p.personalStreak}
            </span>
          </div>
        ))}
      </div>
    </MomentScreen>
  );
}
