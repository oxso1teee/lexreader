"use client";

import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/product/moments/confetti";
import { MomentScreen } from "@/components/product/moments/moment-screen";
import { useCountUp } from "@/components/product/moments/use-count-up";
import { estimateReviewMinutes } from "@/lib/brain-stats";

function tasksLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} задание`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} задания`;
  return `${n} заданий`;
}

// Эталон: docs/moments/mockups/Halfway.dc.html, reference/Halfway.png:
// крестик и полоса занятия с флажком на середине, облачко «Половина пути!»,
// прыгающий маскот с тенью и искрами, конфетти от флажка, три плитки.
// Цифры честные: combo и xpSoFar накоплены в review-session.tsx, минуты —
// estimateReviewMinutes(оставшиеся карточки).
export function HalfwayScreen({
  combo,
  xpSoFar,
  cardsRemaining,
  progress = 0.5,
  onContinue,
  onQuit,
}: {
  combo: number;
  xpSoFar: number;
  cardsRemaining: number;
  /** Доля пройденного (0..1) для полосы сверху. */
  progress?: number;
  onContinue: () => void;
  onQuit?: () => void;
}) {
  const minutesLeft = estimateReviewMinutes(cardsRemaining);
  const comboV = useCountUp(combo, { delay: 800, duration: 900 });
  const xpV = useCountUp(xpSoFar, { delay: 800, duration: 900 });
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <MomentScreen
      title="Половина пути"
      haptic="medium"
      onClose={onContinue}
      footerDelay={1}
      footer={
        <Button className="mo-cta" onClick={onContinue}>
          Продолжить
        </Button>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 0 8px" }}>
        {onQuit ? (
          <button type="button" aria-label="Закрыть занятие" onClick={onQuit} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "none", borderRadius: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }}>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 44 }} />
        )}
        <div
          role="progressbar"
          aria-label="Прогресс занятия"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          style={{ flex: 1, height: 16, borderRadius: 99, background: "var(--surface-muted)", position: "relative" }}
        >
          <div className="hw-fill" style={{ ["--to" as string]: `${pct}%` }} />
          <svg className="hw-flag" viewBox="0 0 24 28" width="22" height="26" aria-hidden="true" style={{ left: `${pct}%` }}>
            <path d="M5 26V3" stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" />
            <path className="hw-flagw" d="M6 3h13l-3 5 3 5H6z" fill="var(--danger)" />
          </svg>
          <Confetti seed={31} count={18} reach={[60, 120]} fall={0} delay={0.85} arc={[0.15 * Math.PI, 0.85 * Math.PI]} style={{ left: `${pct}%`, top: 0 }} />
        </div>
      </div>

      <div style={{ textAlign: "center", paddingTop: 110 }}>
        <div className="hw-bubble" style={{ display: "inline-block", position: "relative", background: "var(--surface)", border: "2px solid var(--border-strong)", borderRadius: 22, padding: "16px 22px", maxWidth: 300 }}>
          <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>Половина пути!</div>
          <div style={{ fontSize: 16, marginTop: 6 }}>Держишь темп. Ещё {tasksLabel(cardsRemaining)}</div>
          <span aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: -12, width: 22, height: 22, marginLeft: -11, background: "var(--surface)", borderRight: "2px solid var(--border-strong)", borderBottom: "2px solid var(--border-strong)", transform: "rotate(45deg)" }} />
        </div>
        <div style={{ position: "relative", height: 230, marginTop: 26, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
          <svg className="hw-tw" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style={{ left: 90, top: 40 }}>
            <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--sun)" />
          </svg>
          <svg className="hw-tw" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ right: 96, top: 70, animationDelay: ".7s" }}>
            <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--ember)" />
          </svg>
          <div className="hw-shd" aria-hidden="true" style={{ position: "absolute", bottom: 4, width: 110, height: 18, borderRadius: "50%", background: "var(--foreground)" }} />
          <div className="hw-jump">
            <svg viewBox="0 0 128 150" width="160" height="188" aria-hidden="true">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
              <path d="M50 62q4-5 8 0M62 62q4-5 8 0" fill="none" stroke="var(--leaf-edge)" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M52 70q8 9 16 0z" fill="var(--leaf-edge)" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
              <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
            </svg>
          </div>
        </div>
        <div className="mo-rise" style={{ display: "flex", gap: 8, margin: "22px 20px 0", animationDelay: ".7s" }}>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, textAlign: "center", background: "var(--ember-tint)", color: "#9a330a" }}>
            <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900 }}>{comboV}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>подряд верно</div>
          </div>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, textAlign: "center", background: "var(--sun-tint)", color: "var(--sun-text)" }}>
            <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900 }}>+{xpV}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>XP уже</div>
          </div>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, textAlign: "center", background: "var(--leaf-tint)", color: "var(--leaf-text)" }}>
            <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900 }}>{minutesLeft}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>мин до финиша</div>
          </div>
        </div>
      </div>
    </MomentScreen>
  );
}
