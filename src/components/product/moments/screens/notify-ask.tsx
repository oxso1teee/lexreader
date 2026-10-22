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

export function NotifyAskScreen({ moment, onClose }: { moment: NotifyAskMoment; onClose: () => void }) {
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

  return (
    <MomentScreen
      title="Напомнить, если забудешь?"
      background="var(--surface)"
      foreground="var(--text-primary)"
      haptic="light"
      onClose={onClose}
      footerDelay={0.8}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            className="mo-cta"
            disabled={pending}
            onClick={enable}
            style={{ "--btn-fill": "var(--leaf)", "--btn-edge": "var(--leaf-edge)", "--btn-label": "#fff" } as React.CSSProperties}
          >
            {pending ? "…" : `Включить в ${formatHour(HOURS[t])}`}
          </Button>
          <button type="button" onClick={onClose} className="text-center text-sm font-semibold text-[var(--text-secondary)] underline">
            Не сейчас
          </button>
        </div>
      }
    >
      <div className="mo-bob mx-auto mt-4 w-fit">
        <svg viewBox="0 0 128 150" width={120} height={140} aria-hidden="true">
          <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
          <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
          <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-deep)" />
          <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-deep)" />
          <path d="M54 72q6 5 12 0" fill="none" stroke="var(--leaf-deep)" strokeWidth={2.4} strokeLinecap="round" />
          <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
          <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
        </svg>
      </div>

      <h1 className="mt-2 text-center text-[23px] font-black leading-tight">Напомнить, если забудешь?</h1>
      <p className="mt-2 text-center text-[15px] text-[var(--text-secondary)]">
        Одно сообщение вечером и только если ты ещё не занимался. Без спама.
      </p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold text-[var(--text-secondary)]">Во сколько напоминать</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Время напоминания">
          {HOURS.map((h, i) => {
            const on = i === t;
            return (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setT(i)}
                className="min-h-[48px] flex-1 rounded-xl border-2 font-bold"
                style={{
                  background: on ? "var(--leaf-tint)" : "var(--surface)",
                  borderColor: on ? "var(--leaf)" : "var(--border)",
                  color: on ? "var(--leaf-text)" : "var(--text-primary)",
                  boxShadow: `inset 0 -4px 0 0 ${on ? "var(--leaf)" : "var(--border)"}`,
                }}
              >
                {formatHour(h)}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-[var(--color-danger-text)]">
          {error}
        </p>
      )}
    </MomentScreen>
  );
}
