"use client";

import { Button } from "@/components/ui/button";
import type { WelcomeBackMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Welcome-back.dc.html.
function daysWordRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

export function WelcomeBackScreen({ moment, onClose }: { moment: WelcomeBackMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title={`С возвращением, ${moment.name}!`}
      background="var(--leaf)"
      foreground="#fff"
      haptic="success"
      onClose={onClose}
      footerDelay={1.2}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            className="mo-cta"
            onClick={onClose}
            style={{ "--btn-fill": "#fff", "--btn-edge": "var(--leaf-tint-strong)", "--btn-label": "var(--leaf-text)" } as React.CSSProperties}
          >
            Мягкий старт · 3 мин
          </Button>
          <button type="button" onClick={onClose} className="text-center text-sm font-semibold text-white underline">
            Сразу на главную
          </button>
        </div>
      }
    >
      <div className="mo-bob mx-auto w-fit">
        <svg viewBox="0 0 128 150" width={150} height={176} aria-hidden="true">
          <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf-tint-strong)" />
          <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="#fff" opacity="0.9" />
          <path d="M50 62q4-5 8 0M62 62q4-5 8 0" fill="none" stroke="var(--leaf-deep)" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M52 70q8 10 16 0z" fill="var(--leaf-deep)" />
          <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
          <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
        </svg>
      </div>
      <h1 className="mt-3 text-center text-[27px] font-black leading-tight">С возвращением, {moment.name}!</h1>
      <p className="mt-3 text-center text-[16px] opacity-95">
        Тебя не было {moment.daysAway} {daysWordRu(moment.daysAway)}. Ничего страшного: слова никуда не делись.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {moment.dueReviewCount > 0 && (
          <div className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold" style={{ background: "rgba(255,255,255,.14)" }}>
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
              <rect x="3" y="6" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth={2} />
              <path d="M7 2h12a2 2 0 0 1 2 2v12" fill="none" stroke="currentColor" strokeWidth={2} />
            </svg>
            Лёгкий повтор: {moment.dueReviewCount} слов, которые подзабылись
          </div>
        )}
        {moment.continueChapter && (
          <div className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold" style={{ background: "rgba(255,255,255,.14)" }}>
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
              <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" fill="none" stroke="currentColor" strokeWidth={2} />
              <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" fill="none" stroke="currentColor" strokeWidth={2} />
            </svg>
            Потом «{moment.continueChapter.collectionTitle}» — глава {moment.continueChapter.chapterPosition} с места, где остановился
          </div>
        )}
      </div>
    </MomentScreen>
  );
}
