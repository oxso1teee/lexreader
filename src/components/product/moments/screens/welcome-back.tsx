"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { WelcomeBackMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Welcome-back.dc.html, reference/Welcome-back.png:
// зелёный экран, всплывающие листики, маскот впрыгивает и машет, план
// «мягкого старта» из двух пунктов. Пункты — реальные: просроченные карточки
// (getDueCount) и глава, на которой остановился (welcome-back-actions.ts).
function daysWordRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function wordsWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "слово, которое подзабылось";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "слова, которые подзабылись";
  return "слов, которые подзабылись";
}

const LEAVES: CSSProperties[] = (() => {
  let s = 81;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const cols = ["var(--leaf-tint-strong)", "var(--sun)", "var(--leaf-tint)"];
  return Array.from({ length: 9 }, (_, i) => ({
    left: Math.round(r() * 370),
    background: cols[i % 3],
    ["--dx" as string]: `${Math.round(r() * 80 - 40)}px`,
    ["--r" as string]: `${Math.round(r() * 360)}deg`,
    ["--t" as string]: `${(7 + r() * 5).toFixed(2)}s`,
    ["--d" as string]: `${(-r() * 9).toFixed(2)}s`,
  }) as CSSProperties);
})();

export function WelcomeBackScreen({ moment, onClose }: { moment: WelcomeBackMoment; onClose: () => void }) {
  const router = useRouter();
  const start = () => {
    onClose();
    if (moment.dueReviewCount > 0) router.push("/brain/all/review");
    else if (moment.continueChapter) router.push(`/read/${moment.continueChapter.textId}`);
  };
  const minutes = Math.max(1, Math.min(5, Math.round((moment.dueReviewCount * 20) / 60) || 3));

  return (
    <MomentScreen
      title={`С возвращением, ${moment.name}!`}
      background="var(--leaf)"
      foreground="#fff"
      haptic="success"
      onClose={onClose}
      footerDelay={1.35}
      footer={
        <>
          <Button
            className="mo-cta"
            onClick={start}
            style={{ ["--btn-fill" as string]: "#fff", ["--btn-edge" as string]: "var(--leaf-tint-strong)", ["--btn-label" as string]: "var(--leaf-text)" } as CSSProperties}
          >
            Мягкий старт · {minutes} мин
          </Button>
          <button type="button" onClick={onClose} className="mo-link2" style={{ color: "#fff" }}>
            Сразу на главную
          </button>
        </>
      }
    >
      <div aria-hidden="true" style={{ position: "absolute", width: 420, height: 420, borderRadius: 999, background: "var(--leaf-edge)", opacity: 0.45, left: -110, top: -170 }} />
      {LEAVES.map((st, i) => (
        <span key={i} className="wb-lf" style={st} aria-hidden="true" />
      ))}

      <div style={{ position: "relative", textAlign: "center", paddingTop: 90 }}>
        <div className="wb-enter" style={{ display: "inline-flex", alignItems: "flex-end" }} aria-hidden="true">
          <div className="wb-jump">
            <svg viewBox="0 0 128 150" width="150" height="176">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf-tint-strong)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="#fff" opacity="0.9" />
              <path d="M50 62q4-5 8 0M62 62q4-5 8 0" fill="none" stroke="var(--leaf-edge)" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M52 70q8 10 16 0z" fill="var(--leaf-edge)" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
              <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
            </svg>
          </div>
          <div className="wb-wave" style={{ marginLeft: -18, marginBottom: 92 }}>
            <svg viewBox="0 0 40 60" width="34" height="50">
              <ellipse cx="20" cy="22" rx="14" ry="20" fill="var(--sun)" />
            </svg>
          </div>
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "18px 24px 0", fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: ".7s" }}>
          С возвращением, {moment.name}!
        </h2>
        <p className="mo-rise" style={{ margin: "12px 30px 0", fontSize: 16, lineHeight: 1.45, opacity: 0.95, animationDelay: ".82s" }}>
          Тебя не было {moment.daysAway} {daysWordRu(moment.daysAway)}. Ничего страшного: слова никуда не делись.
        </p>
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, padding: "26px 20px 0" }}>
        {moment.dueReviewCount > 0 && (
          <div className="wb-item wb-slide" style={{ animationDelay: "1s" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, flex: "none" }}>
              <rect x="3" y="6" width="14" height="14" rx="2" />
              <path d="M7 2h12a2 2 0 0 1 2 2v12" />
            </svg>
            Лёгкий повтор: {moment.dueReviewCount} {wordsWord(moment.dueReviewCount)}
          </div>
        )}
        {moment.continueChapter && (
          <div className="wb-item wb-slide" style={{ animationDelay: "1.12s" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, flex: "none" }}>
              <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" />
              <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
            </svg>
            Потом глава {moment.continueChapter.chapterPosition} «{moment.continueChapter.collectionTitle}» с места, где остановился
          </div>
        )}
      </div>
    </MomentScreen>
  );
}
