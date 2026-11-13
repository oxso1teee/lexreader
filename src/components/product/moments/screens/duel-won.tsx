"use client";

import type { DuelState, DuelClaimResult } from "@/lib/duel";
import { Button } from "@/components/ui/button";
import { Confetti } from "../confetti";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Duel-won.dc.html, reference/Duel-won.png:
// синий экран, аватары въезжают с боков, столбики счёта растут, корона
// падает на победителя, «Победа!», чипы XP и серии побед. Все цифры —
// из claim_duel_result() (XP, серия побед, разница в секундах).
function winsWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "победа подряд";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "победы подряд";
  return "побед подряд";
}

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
  const me = useCountUp(result.scoreMe, { delay: 800, duration: 1200 });
  const opp = useCountUp(result.scoreOpponent, { delay: 800, duration: 1200 });
  const xp = useCountUp(result.xpToAward, { delay: 2450, duration: 700 });
  const iWon = state.winnerIsMe && !state.isDraw;
  const oppInitials = state.isCreator ? state.opponentInitials ?? "?" : state.creatorInitials;
  const myInitials = (state.isCreator ? state.creatorInitials : state.opponentInitials) ?? "Ты";
  const title = state.isDraw ? "Ничья!" : iWon ? "Победа!" : "Почти!";
  const speed =
    result.speedMarginSec > 0
      ? ` и на ${result.speedMarginSec} с быстрее`
      : result.speedMarginSec < 0
        ? `, но на ${Math.abs(result.speedMarginSec)} с медленнее`
        : "";

  return (
    <MomentScreen
      title={title}
      background="#0b79b0"
      foreground="#fff"
      haptic={iWon ? "success" : "light"}
      onClose={onClose}
      footerDelay={2.7}
      footer={
        <div style={{ display: "flex", gap: 12 }}>
          <Button
            onClick={onRematch}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "rgba(255,255,255,.14)", ["--btn-edge" as string]: "rgba(0,0,0,.18)", ["--btn-label" as string]: "#fff", flex: "0 0 auto", width: "auto", paddingLeft: 18, paddingRight: 18 }}
          >
            Реванш
          </Button>
          <Button
            onClick={onClose}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "#fff", ["--btn-edge" as string]: "#bfe6fb", ["--btn-label" as string]: "#075a85", flex: 1 }}
          >
            {result.xpToAward > 0 ? "Забрать награду" : "Продолжить"}
          </Button>
        </div>
      }
    >
      <div aria-hidden="true" style={{ position: "absolute", width: 480, height: 480, borderRadius: 999, background: "#075a85", opacity: 0.5, left: -45, top: 30 }} />
      <div className="mo-rise" style={{ position: "relative", textAlign: "center", paddingTop: 64, fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#bfe6fb" }}>
        Дуэль · {state.roundCount} заданий
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 22, padding: "26px 40px 0", height: 400 }}>
        {iWon && <Confetti seed={41} count={30} delay={2.1} reach={[120, 120]} fall={0} colors={["var(--sun)", "#fff", "var(--leaf)", "var(--ember)", "#bfe6fb"]} style={{ left: "35%", top: 120 }} />}
        <div className="dw-inL" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
          {iWon && (
            <svg className="dw-crown" viewBox="0 0 128 60" width="56" height="26" aria-hidden="true" style={{ marginBottom: 4 }}>
              <path d="M10 56 L18 12 L42 36 L64 4 L86 36 L110 12 L118 56 Z" fill="#ffc700" stroke="#7a5900" strokeWidth="6" strokeLinejoin="round" />
            </svg>
          )}
          <div className={iWon ? "dw-av dw-winner" : "dw-av dw-loser"} style={{ background: "var(--leaf)" }}>{myInitials.slice(0, 2)}</div>
          <div style={{ fontWeight: 700, fontSize: 16, margin: "8px 0 10px" }}>Ты</div>
          <div className="dw-col" style={{ height: 40 + me * 13, background: "#ffc700", color: "#4d3800", boxShadow: "inset 0 -6px 0 0 #e0a500" }}>
            {me}
          </div>
        </div>
        <div className="mo-disp dw-clash" style={{ position: "absolute", left: "50%", top: 150, width: 54, height: 54, marginLeft: -27, borderRadius: 999, background: "#fff", color: "#075a85", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900 }} aria-hidden="true">
          VS
        </div>
        <div className="dw-inR" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
          {!iWon && !state.isDraw && (
            <svg className="dw-crown" viewBox="0 0 128 60" width="56" height="26" aria-hidden="true" style={{ marginBottom: 4 }}>
              <path d="M10 56 L18 12 L42 36 L64 4 L86 36 L110 12 L118 56 Z" fill="#ffc700" stroke="#7a5900" strokeWidth="6" strokeLinejoin="round" />
            </svg>
          )}
          <div className={iWon ? "dw-av dw-loser" : "dw-av dw-winner"} style={{ background: "#8b5cf6" }}>{oppInitials}</div>
          <div style={{ fontWeight: 700, fontSize: 16, margin: "8px 0 10px" }}>Соперник</div>
          <div className="dw-col" style={{ height: 40 + opp * 13, background: "rgba(255,255,255,.22)", color: "#fff" }}>
            {opp}
          </div>
        </div>
      </div>

      <div style={{ position: "relative", textAlign: "center", padding: "22px 24px 0" }}>
        <h2 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: "2.2s" }}>
          {title}
        </h2>
        <p className="mo-rise" style={{ margin: "8px 0 0", fontSize: 16, opacity: 0.92, animationDelay: "2.3s" }}>
          {result.scoreMe} из {state.roundCount}
          {speed}
        </p>
        <div className="mo-rise" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, animationDelay: "2.45s" }}>
          {result.xpToAward > 0 && <span className="dw-chip" style={{ background: "#ffc700", color: "#4d3800" }}>+{xp} XP</span>}
          {result.winStreak > 1 && <span className="dw-chip" style={{ background: "rgba(255,255,255,.16)" }}>{result.winStreak} {winsWord(result.winStreak)}</span>}
        </div>
      </div>
    </MomentScreen>
  );
}
