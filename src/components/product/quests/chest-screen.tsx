"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { claimChestAction } from "@/app/(app)/quests/actions";

// docs/moments/mockups/Chest.dc.html, reference/Chest.png + Chest--open.png.
// Фазы ровно как в макете: closed (ждём тап) -> shaking (750мс) -> open
// (реальный claimChestAction() вызывается в момент перехода в open, не
// раньше — открытие на экране не обгоняет реальное начисление).
type Phase = "closed" | "shaking" | "open" | "error";

function makeCoins(seed: number): { style: React.CSSProperties }[] {
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const coins: { style: React.CSSProperties }[] = [];
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI * (0.08 + r() * 0.84);
    const d = 120 + r() * 160;
    coins.push({
      style: {
        ["--dx" as string]: `${Math.round(Math.cos(a) * d)}px`,
        ["--dy" as string]: `${Math.round(Math.sin(a) * d)}px`,
        ["--d" as string]: `${(r() * 0.15).toFixed(2)}s`,
        ["--t" as string]: `${(0.9 + r() * 0.6).toFixed(2)}s`,
      } as React.CSSProperties,
    });
  }
  return coins;
}

export function ChestScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("closed");
  const [reward, setReward] = useState<{ xpAwarded: number; boostUntil: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coins] = useState(() => makeCoins(5));

  function openChest() {
    if (phase !== "closed") return;
    if (reduceMotion) {
      void finishOpen();
      return;
    }
    setPhase("shaking");
    setTimeout(() => {
      void finishOpen();
    }, 750);
  }

  async function finishOpen() {
    const result = await claimChestAction();
    if (!result.ok || result.xpAwarded === undefined || !result.boostUntil) {
      setPhase("error");
      setError(result.error ?? "Не удалось открыть сундук.");
      return;
    }
    setReward({ xpAwarded: result.xpAwarded, boostUntil: result.boostUntil });
    setPhase("open");
  }

  const wcls = phase === "closed" ? "mo-wiggle" : phase === "shaking" ? "mo-shake" : "";

  return (
    <div className="mo-screen" style={{ background: "#3a1d0a", color: "#fff" }} role="dialog" aria-modal="true" aria-label="Сундук за задания дня">
      <div className="mo-column">
        {phase === "open" && <div className="mo-chestflash" aria-hidden="true" />}
        <div style={{ position: "relative", height: 400, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 30 }}>
          {phase === "open" && !reduceMotion && (
            <div style={{ position: "absolute", left: "50%", bottom: 110, width: 0, height: 0, zIndex: 3 }}>
              {coins.map((c, i) => (
                <span key={i} className="mo-coin" style={c.style} />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={openChest}
            aria-label={phase === "open" ? "Сундук открыт" : "Открыть сундук"}
            disabled={phase !== "closed"}
            style={{ position: "relative", border: 0, background: "none", padding: 0, cursor: phase === "closed" ? "pointer" : "default" }}
          >
            <div className={wcls}>
              <svg viewBox="0 0 200 170" width="200" height="170" aria-hidden="true" style={{ overflow: "visible" }}>
                <rect x="16" y="70" width="168" height="92" rx="14" fill="#c2410c" stroke="#1a0c03" strokeWidth="7" />
                <rect x="16" y="108" width="168" height="10" fill="#7c2d0a" />
                <rect x="86" y="96" width="28" height="34" rx="6" fill="#ffc700" stroke="#1a0c03" strokeWidth="5" />
                <g className={phase === "open" ? "mo-lidopen" : ""} style={{ transformOrigin: "100px 76px" }}>
                  <path d="M16 78 Q100 6 184 78 V86 H16z" fill="#ff9500" stroke="#1a0c03" strokeWidth="7" strokeLinejoin="round" />
                  <rect x="86" y="62" width="28" height="22" rx="6" fill="#ffc700" stroke="#1a0c03" strokeWidth="5" />
                </g>
              </svg>
            </div>
          </button>
        </div>

        {phase !== "open" && (
          <div style={{ textAlign: "center", padding: "0 28px" }}>
            <h1 className="mo-disp" style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 900 }}>Сундук за задания дня</h1>
            {phase === "error" ? (
              <p style={{ margin: "16px 0 0", fontSize: 15, color: "#ffb4b4" }}>{error}</p>
            ) : (
              <p className="mo-hint" style={{ margin: "16px 0 0", fontSize: 15, fontWeight: 700, color: "#ffc700" }}>
                {phase === "shaking" ? "Открывается…" : "Нажми на сундук"}
              </p>
            )}
          </div>
        )}

        {phase === "open" && reward && (
          <>
            <div style={{ padding: "0 20px" }}>
              <h1 className="mo-disp mo-rise" style={{ margin: "0 0 16px", textAlign: "center", fontSize: 22, fontWeight: 900 }}>Внутри:</h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="mo-rise" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,.1)", border: "2px solid rgba(255,255,255,.14)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ffc700", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>⚡</div>
                  <div className="mo-disp" style={{ fontSize: 18, fontWeight: 900 }}>+{reward.xpAwarded} XP</div>
                </div>
                <div className="mo-rise" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,.1)", border: "2px solid rgba(255,255,255,.14)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#1cb0f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>❄️</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>+1 заморозка стрика</div>
                </div>
                <div className="mo-rise" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,.1)", border: "2px solid rgba(255,255,255,.14)" }}>
                  <div className="mo-disp" style={{ width: 44, height: 44, borderRadius: 12, background: "#2b820f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontWeight: 900, fontSize: 15 }}>×2</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Двойной опыт на 15 минут</div>
                </div>
              </div>
            </div>
            <div className="mo-footer">
              <Button
                variant="sun"
                className="mo-cta"
                onClick={() => router.push(`/quests/double-xp?until=${encodeURIComponent(reward.boostUntil)}`)}
              >
                Забрать всё
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
