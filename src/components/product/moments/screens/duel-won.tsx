"use client";

import type { DuelState, DuelClaimResult } from "@/lib/duel";
import { Button } from "@/components/ui/button";
import { Confetti } from "../confetti";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Duel-won.dc.html, reference/Duel-won.png.
// Макет показывает только победу — добро добавлены варианты "Поражение"/
// "Ничья" (та же дуэль может завершиться любым из трёх исходов). XP/серия
// побед подряд/разница в секундах — реальные числа из claim_duel_result()
// (0055), не декоративные.
export function DuelWonScreen({
  state,
  result,
  onRematch,
  onClose,
}: {
  state: DuelState;
  result: DuelClaimResult;
  onRematch: () => void;
  onClose: () => void;
}) {
  const myScore = useCountUp(result.scoreMe, { delay: 400, duration: 900 });
  const oppScore = useCountUp(result.scoreOpponent, { delay: 400, duration: 900 });
  const xp = useCountUp(result.xpToAward, { delay: 2450, duration: 700 });

  const title = state.isDraw ? "Ничья!" : state.winnerIsMe ? "Победа!" : "Поражение";
  const speedLabel =
    result.speedMarginSec === 0
      ? null
      : result.speedMarginSec > 0
        ? `и на ${result.speedMarginSec} секунд быстрее`
        : `но на ${Math.abs(result.speedMarginSec)} секунд медленнее`;

  return (
    <MomentScreen
      title={title}
      background="var(--sky)"
      foreground="#fff"
      onClose={onClose}
      footerDelay={1.6}
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            type="button"
            onClick={onRematch}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "transparent", ["--btn-edge" as string]: "rgba(255,255,255,.5)", ["--btn-label" as string]: "#fff", flex: "none", width: 110 }}
          >
            Реванш
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "#fff", ["--btn-edge" as string]: "var(--sky-text)", ["--btn-label" as string]: "var(--sky-text)", flex: 1 }}
          >
            Забрать награду
          </Button>
        </div>
      }
    >
      <Confetti seed={23} count={30} delay={0.1} reach={[150, 110]} fall={0} style={{ left: "50%", top: 60 }} />

      <p className="mo-muted" style={{ textAlign: "center", paddingTop: 36, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Дуэль · {state.roundCount} заданий
      </p>

      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28, marginTop: 20 }}>
        <ScoreColumn initials="Ты" score={myScore} isWinner={state.winnerIsMe} isLoser={!state.isDraw && !state.winnerIsMe} />
        <span
          className="mo-zoom"
          style={{
            position: "absolute",
            top: -4,
            left: "50%",
            marginLeft: -27,
            width: 54,
            height: 54,
            borderRadius: 999,
            background: "#fff",
            color: "var(--sky-text)",
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          VS
        </span>
        <ScoreColumn initials={state.isCreator ? (state.opponentInitials ?? "…") : state.creatorInitials} score={oppScore} isWinner={!state.isDraw && !state.winnerIsMe} isLoser={state.winnerIsMe} />
      </div>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <h2 className="mo-disp mo-rise" style={{ fontSize: 28, fontWeight: 900 }}>
          {title}
        </h2>
        <p className="mo-muted" style={{ margin: "6px 24px 0", fontSize: 15 }}>
          {result.scoreMe} из {state.roundCount}
          {speedLabel ? ` ${speedLabel}` : ""}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
          {result.xpToAward > 0 && (
            <span style={{ borderRadius: 999, background: "var(--sun)", color: "var(--sun-text)", fontWeight: 900, padding: "6px 14px", fontSize: 14 }}>+{xp} XP</span>
          )}
          {result.winStreak > 1 && (
            <span style={{ borderRadius: 999, background: "rgba(255,255,255,.2)", color: "#fff", fontWeight: 700, padding: "6px 14px", fontSize: 14 }}>
              {result.winStreak} {result.winStreak < 5 ? "победы" : "побед"} подряд
            </span>
          )}
        </div>
      </div>
    </MomentScreen>
  );
}

function ScoreColumn({ initials, score, isWinner, isLoser }: { initials: string; score: number; isWinner: boolean; isLoser: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: isLoser ? 0.6 : 1 }}>
      {isWinner && (
        <svg className="mo-crown" viewBox="0 0 128 60" width="48" height="22" aria-hidden="true">
          <path d="M10 56 L18 12 L42 36 L64 4 L86 36 L110 12 L118 56 Z" fill="var(--sun)" stroke="var(--sun-text)" strokeWidth="4" strokeLinejoin="round" />
        </svg>
      )}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: isWinner ? "var(--color-forest)" : "rgba(255,255,255,.25)",
          color: "#fff",
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: isWinner ? "scale(1.08)" : undefined,
        }}
      >
        {initials}
      </div>
      <span style={{ fontWeight: 900, fontSize: 26, fontVariantNumeric: "tabular-nums" }}>{score}</span>
    </div>
  );
}
