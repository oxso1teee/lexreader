"use client";

import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/product/moments/confetti";
import { MomentScreen } from "@/components/product/moments/moment-screen";
import { estimateReviewMinutes } from "@/lib/brain-stats";

// Тот же 3-формный русский plural, что у wordCountLabel в session-
// complete.tsx — бинарный "N===1 ? X : Y" даёт неверную форму при N=2-4.
function tasksLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} задание`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} задания`;
  return `${n} заданий`;
}

// docs/moments/mockups/Halfway.dc.html, reference/Halfway.png. Все три
// цифры внизу — честные: combo и xpSoFar накоплены в review-session.tsx за
// реально пройденные карточки этой сессии, minutesLeft — estimateReviewMinutes
// (та же оценка, что Мозг/Practice Home уже показывают для due-очереди, не
// новая формула). MomentScreen даёт фокус-ловушку и Esc=Продолжить бесплатно.
export function HalfwayScreen({
  combo,
  xpSoFar,
  cardsRemaining,
  onContinue,
}: {
  combo: number;
  xpSoFar: number;
  cardsRemaining: number;
  onContinue: () => void;
}) {
  const minutesLeft = estimateReviewMinutes(cardsRemaining);
  return (
    <MomentScreen
      title="Половина пути"
      onClose={onContinue}
      footer={
        <Button variant="leaf" className="mo-cta" onClick={onContinue}>
          Продолжить
        </Button>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 96 }}>
        <div
          className="mo-pop"
          style={{
            display: "inline-block",
            position: "relative",
            background: "var(--surface)",
            border: "2px solid var(--border-strong)",
            borderRadius: 22,
            padding: "16px 22px",
            maxWidth: 300,
          }}
        >
          <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
            Половина пути!
          </div>
          <div style={{ fontSize: 16, marginTop: 6 }}>
            Держишь темп. Ещё {tasksLabel(cardsRemaining)}
          </div>
        </div>

        <div style={{ position: "relative", height: 180, marginTop: 20, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
          <Confetti seed={31} count={18} reach={[60, 120]} fall={0} arc={[0.15 * Math.PI, 0.85 * Math.PI]} style={{ left: "50%", top: "50%" }} />
          <svg viewBox="0 0 128 150" width="120" height="140" aria-hidden="true">
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
            <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
          </svg>
        </div>

        <div className="mo-rise" style={{ display: "flex", gap: 8, margin: "22px 20px 0" }}>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, textAlign: "center", background: "var(--sun-tint)", color: "var(--sun-text)" }}>
            <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900 }}>{combo}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>подряд верно</div>
          </div>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, textAlign: "center", background: "var(--sun-tint)", color: "var(--sun-text)" }}>
            <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900 }}>+{xpSoFar}</div>
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
