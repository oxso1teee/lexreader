"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { NotifyAskMoment } from "@/lib/moments/types";
import { requestPushPermissionAndSubscribe } from "@/lib/push-client";
import { savePushSubscription } from "@/app/(app)/settings/actions";
import { setPreferredNotifyHourAction } from "../notify-ask-actions";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Notify-ask.dc.html.
const HOURS = [19, 21, 22.5] as const;

function formatHour(h: number): string {
  const whole = Math.floor(h);
  const minutes = h % 1 === 0 ? "00" : "30";
  return `${whole}:${minutes}`;
}

export function NotifyAskScreen({ onClose }: { moment: NotifyAskMoment; onClose: () => void }) {
  const [t, setT] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setPending(true);
    setError(null);
    try {
      const sub = await requestPushPermissionAndSubscribe();
      await savePushSubscription(sub);
      await setPreferredNotifyHourAction(HOURS[t]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось включить уведомления.");
      setPending(false);
    }
  }

  const time = formatHour(HOURS[t]);
  return (
    <MomentScreen
      title="Напомнить, если забудешь?"
      haptic="light"
      onClose={onClose}
      footerDelay={1}
      footer={
        <>
          <Button className="mo-cta" disabled={pending} onClick={enable}>
            {pending ? "…" : `Включить в ${time}`}
          </Button>
          <button type="button" onClick={onClose} className="mo-link2">
            Не сейчас
          </button>
        </>
      }
    >
      {/* Эталон: docs/moments/mockups/Notify-ask.dc.html — маскот и
          звенящий колокольчик, пример уведомления, выбор времени. */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", paddingTop: 80 }} aria-hidden="true">
        <div className="na-bob">
          <svg viewBox="0 0 128 150" width="120" height="140">
            <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
            <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
            <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
            <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
            <path d="M54 72q6 5 12 0" fill="none" stroke="var(--leaf-edge)" strokeWidth={2.4} strokeLinecap="round" />
            <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
          </svg>
        </div>
        <div style={{ position: "relative", marginLeft: -10, marginBottom: 70, width: 80, height: 72 }}>
          <svg className="na-arc" viewBox="0 0 80 72" width="80" height="72" style={{ position: "absolute", inset: 0 }}>
            <path d="M6 20a36 36 0 0 0 0 30M74 20a36 36 0 0 1 0 30" fill="none" stroke="var(--sun)" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <div className="na-bell" style={{ position: "absolute", left: 8, top: 4 }}>
            <svg viewBox="0 0 24 24" width="64" height="64">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" fill="var(--sun)" stroke="var(--sun-text)" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" fill="none" stroke="var(--sun-text)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "18px 28px 0" }}>
        <h2 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 25, lineHeight: 1.2, fontWeight: 900, animationDelay: ".2s" }}>
          Напомнить, если забудешь?
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.45, animationDelay: ".3s" }}>
          Одно сообщение вечером и только если ты ещё не занимался. Без спама.
        </p>
      </div>

      <div className="na-notif" style={{ margin: "22px 20px 0", padding: "12px 14px", borderRadius: 18, background: "var(--surface)", border: "2px solid var(--border)", display: "flex", gap: 12, alignItems: "center" }} aria-hidden="true">
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--leaf)", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 128 150" width="22" height="26">
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="#fff" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <b>LexReader</b>
            <span className="mo-muted">{time}</span>
          </div>
          <div style={{ fontSize: 14, marginTop: 2 }}>Пора почитать: 3 минуты, и серия в безопасности</div>
        </div>
      </div>

      <div className="mo-rise" style={{ padding: "20px 20px 0", animationDelay: ".8s" }}>
        <div className="mo-muted" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Во сколько напоминать</div>
        <div style={{ display: "flex", gap: 8 }} role="radiogroup" aria-label="Время напоминания">
          {HOURS.map((h, i) => {
            const on = i === t;
            return (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setT(i)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderStyle: "solid",
                  font: "700 17px/1 var(--font-onest), sans-serif",
                  cursor: "pointer",
                  background: on ? "var(--leaf-tint)" : "var(--surface)",
                  borderColor: on ? "var(--leaf)" : "var(--border-strong)",
                  color: on ? "var(--leaf-text)" : "var(--foreground)",
                  boxShadow: `inset 0 -4px 0 0 ${on ? "var(--leaf)" : "rgba(26,26,26,.1)"}`,
                }}
              >
                {formatHour(h)}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" style={{ margin: "12px 20px 0", textAlign: "center", fontSize: 14, color: "var(--danger-text)" }}>
          {error}
        </p>
      )}
    </MomentScreen>
  );
}
