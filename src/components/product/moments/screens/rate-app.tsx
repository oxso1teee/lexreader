"use client";

import { useState } from "react";
import type { RateAppMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";
import FeedbackForm from "@/app/(app)/settings/feedback-form";

// Эталон: docs/moments/mockups/Rate-app.dc.html. Только нативная сборка
// (гейт в moment-provider.tsx) — 4-5 звёзд открывают нативный диалог
// магазина (@capacitor-community/in-app-review), 1-3 — существующая
// FeedbackForm (settings/feedback-form.tsx), без нового канала.
const SAYS = [
  "Ты занимаешься уже 2 недели. Скажи честно",
  "Ой. Расскажи, что не так, мы исправим",
  "Понял. Что нам улучшить?",
  "Неплохо. Чего не хватает до пятёрки?",
  "Спасибо! Поделишься в магазине?",
  "Ура! Ты лучший читатель",
];

export function RateAppScreen({ onClose }: { moment: RateAppMoment; onClose: () => void }) {
  const [n, setN] = useState(0);
  const [requested, setRequested] = useState(false);

  async function requestNativeReview() {
    try {
      const { InAppReview } = await import("@capacitor-community/in-app-review");
      await InAppReview.requestReview();
    } catch {
      // Плагин не синхронизирован с нативным проектом — не критично.
    } finally {
      setRequested(true);
    }
  }

  return (
    <MomentScreen title="Оцени LexReader" background="var(--surface)" foreground="var(--text-primary)" haptic="light" onClose={onClose} footer={null}>
      <div className="mo-bob mx-auto w-fit">
        <svg viewBox="0 0 128 150" width={90} height={105} aria-hidden="true">
          <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
          <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
          <ellipse cx="54" cy="62" rx="3.2" ry={n === 1 ? 3 : n === 5 ? 2.2 : 4.4} fill="var(--leaf-deep)" />
          <ellipse cx="66" cy="62" rx="3.2" ry={n === 1 ? 3 : n === 5 ? 2.2 : 4.4} fill="var(--leaf-deep)" />
          <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
          <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
        </svg>
      </div>
      <h1 className="mt-2 text-center text-[23px] font-black leading-tight">Как тебе LexReader?</h1>
      <p className="mt-2 min-h-[22px] text-center text-[15px] text-[var(--text-secondary)]" aria-live="polite">
        {SAYS[n]}
      </p>
      <div className="mt-3 flex justify-center gap-1" role="radiogroup" aria-label="Оценка от 1 до 5">
        {[1, 2, 3, 4, 5].map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === n}
            aria-label={`${k} из 5`}
            onClick={() => setN(k)}
            className="flex h-[52px] w-[52px] items-center justify-center"
          >
            <svg viewBox="0 0 24 24" width={46} height={46} aria-hidden="true">
              <path
                d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z"
                fill={k <= n ? "var(--sun)" : "#fff"}
                stroke={k <= n ? "var(--sun-edge)" : "var(--border-strong)"}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {n === 0 && (
          <button type="button" disabled className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[var(--surface-muted)] px-5 font-bold text-[var(--text-secondary)]">
            Выбери оценку
          </button>
        )}
        {n >= 4 &&
          (requested ? (
            <button type="button" onClick={onClose} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl px-5 font-bold text-white" style={{ background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }}>
              Спасибо!
            </button>
          ) : (
            <button type="button" onClick={requestNativeReview} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl px-5 font-bold text-white" style={{ background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }}>
              Оценить в магазине
            </button>
          ))}
        {n > 0 && n < 4 && <FeedbackForm />}
        <button type="button" onClick={onClose} className="mt-3 block w-full text-center text-sm font-semibold text-[var(--text-secondary)] underline">
          Не сейчас
        </button>
      </div>
    </MomentScreen>
  );
}
