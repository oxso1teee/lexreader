"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { ReviewDueMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Review-due.dc.html, reference/Review-due.png —
// нижняя шторка поверх приложения, кривая забывания, чипы слов. Цифры
// настоящие: dueCount (getDueCount), слова — первые просроченные карточки,
// минуты — estimateReviewMinutes. Кривая — схема «память падает → повтор
// поднимает», без выдуманного процента.
function wordsLabel(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "слово начинает";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "слова начинают";
  return "слов начинают";
}

export function ReviewDueScreen({ moment, onClose }: { moment: ReviewDueMoment; onClose: () => void }) {
  const router = useRouter();
  const words = moment.words ?? [];
  const rest = Math.max(0, moment.dueCount - words.length);
  const minutes = moment.minutes ?? Math.max(1, Math.round((moment.dueCount * 20) / 60));

  return (
    <MomentScreen
      variant="sheet"
      title="Пора повторить слова"
      haptic="light"
      onClose={onClose}
      footerDelay={0}
      footer={
        <div style={{ marginTop: 18 }}>
          <Button
            variant="sky"
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "#0b79b0", ["--btn-edge" as string]: "#075a85", ["--btn-label" as string]: "#fff" }}
            onClick={() => {
              onClose();
              router.push("/brain/all/review");
            }}
          >
            Повторить · {minutes} мин
          </Button>
          <button type="button" className="mo-link2" onClick={onClose}>
            Напомнить вечером
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 60, height: 70, flex: "none" }}>
          <svg viewBox="0 0 128 150" width="60" height="70" aria-hidden="true">
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
            <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
            <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
            <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
            <ellipse cx="60" cy="74" rx="4" ry="3.4" fill="var(--leaf-edge)" />
            <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h2 className="mo-disp" style={{ margin: 0, fontSize: 21, lineHeight: 1.2, fontWeight: 900 }}>
            {moment.dueCount} {wordsLabel(moment.dueCount)} забываться
          </h2>
          <p className="mo-muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
            Повтори сейчас, и они снова закрепятся в памяти
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: "12px 12px 8px", borderRadius: 18, background: "var(--background)" }}>
        <div className="mo-muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
          <span>Насколько помнишь</span>
          <span>дни</span>
        </div>
        <svg viewBox="0 0 320 120" width="100%" height="120" role="img" aria-label="Память со временем падает, повтор поднимает её обратно">
          <path d="M10 104H310" stroke="var(--border-strong)" strokeWidth="2" />
          <path d="M10 20H310" stroke="var(--surface-muted)" strokeWidth="2" strokeDasharray="4 6" />
          <text x="12" y="14" textAnchor="start" fontSize="10" fontWeight="700" fill="var(--text-secondary)" fontFamily="var(--font-onest), sans-serif">
            100%
          </text>
          <path className="rd-curve" d="M10 20 C60 40 100 58 150 66" fill="none" stroke="var(--sky)" strokeWidth="5" strokeLinecap="round" />
          <path d="M150 66 C200 74 250 86 310 92" fill="none" stroke="rgba(28,176,246,.4)" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 8" />
          <path className="rd-boost" d="M150 66 L150 22 C210 30 260 38 310 46" fill="none" stroke="var(--leaf)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle className="rd-ping" cx="150" cy="66" r="6" fill="none" stroke="var(--danger)" strokeWidth="3" />
          <circle cx="150" cy="66" r="6" fill="var(--danger)" />
          <text x="158" y="84" fontSize="11" fontWeight="700" fill="var(--danger-text)" fontFamily="var(--font-onest), sans-serif">
            сегодня
          </text>
          <text x="214" y="70" fontSize="11" fontWeight="700" fill="var(--leaf-text)" fontFamily="var(--font-onest), sans-serif" className="mo-rise" style={{ animationDelay: "2.4s" }}>
            после повтора
          </text>
        </svg>
      </div>

      {words.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }} aria-label="Слова на повтор">
          {words.map((w, i) => (
            <span key={w + i} className="rd-w" style={{ ["--d" as string]: `${0.5 + i * 0.1}s` } as CSSProperties}>
              {w}
            </span>
          ))}
          {rest > 0 && (
            <span
              className="rd-w"
              style={{ ["--d" as string]: `${0.5 + words.length * 0.1}s`, background: "var(--surface-muted)", color: "var(--text-secondary)", fontFamily: "var(--font-onest), sans-serif", fontSize: 13, fontWeight: 700 } as CSSProperties}
            >
              +{rest}
            </span>
          )}
        </div>
      )}
    </MomentScreen>
  );
}
