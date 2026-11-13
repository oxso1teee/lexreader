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
      title={`${moment.sharedStreak} дней вместе с ${moment.friendName}`}
      onClose={onClose}
      footerDelay={1.8}
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            type="button"
            disabled={invited || !primaryPartner}
            onClick={handleInvite}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "transparent", ["--btn-edge" as string]: "var(--border-strong)", ["--btn-label" as string]: "var(--foreground)", flex: "none", width: 120 }}
          >
            {invited ? "Позвали" : "Позвать"}
          </Button>
          <Button
            className="mo-cta"
            onClick={onClose}
            style={{ ["--btn-fill" as string]: "var(--ember)", ["--btn-edge" as string]: "var(--ember-text)", ["--btn-label" as string]: "#fff", flex: 1 }}
          >
            Так держать
          </Button>
        </div>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 72 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <div
            className="mo-slidein"
            style={{ width: 56, height: 56, borderRadius: 999, background: "var(--color-forest)", color: "#fff", fontWeight: 900, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-hidden="true"
          >
            Ты
          </div>
          <div className="mo-ignite" style={{ position: "relative", width: 60, height: 60 }}>
            <Confetti seed={17} count={26} delay={0.2} reach={[90, 70]} fall={0} style={{ left: "50%", top: "50%" }} />
            <div className="mo-flick" style={{ position: "relative" }}>
              <svg viewBox="0 0 24 24" width="60" height="60" aria-hidden="true">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
                <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
              </svg>
            </div>
          </div>
          <div
            className="mo-slidein"
            style={{ width: 56, height: 56, borderRadius: 999, background: "var(--sky)", color: "#fff", fontWeight: 900, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-hidden="true"
          >
            {moment.partners[0]?.initial ?? "?"}
          </div>
        </div>

        <div className="mo-disp" style={{ marginTop: 20, fontSize: 64, fontWeight: 900, lineHeight: 1, color: "var(--ember-text)" }} aria-hidden="true">
          {n}
        </div>
        <p className="mo-muted" style={{ margin: "4px 28px 0", fontSize: 16, fontWeight: 600 }}>
          Каждый занимается сам, серия общая. Пропустит один, сгорит у обоих.
        </p>
      </div>

      <div className="mo-cardin" style={{ margin: "24px 20px 0", display: "flex", flexDirection: "column", gap: 0, borderRadius: 18, border: "2px solid rgba(26,26,26,.18)", overflow: "hidden" }}>
        {moment.partners.map((p, i) => (
          <div
            key={p.name}
            style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderTop: i > 0 ? "1px solid rgba(26,26,26,.1)" : undefined }}
          >
            <span style={{ width: 36, height: 36, borderRadius: 999, background: "var(--sky)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {p.initial}
            </span>
            <span style={{ fontWeight: 700, flex: 1 }}>{p.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ember-text)", fontWeight: 900 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="currentColor" />
              </svg>
              {p.personalStreak}
            </span>
          </div>
        ))}
      </div>
    </MomentScreen>
  );
}
