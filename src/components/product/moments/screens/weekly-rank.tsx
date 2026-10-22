"use client";

import { Button } from "@/components/ui/button";
import type { WeeklyRankMoment, WeeklyRankPodiumEntry } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Weekly-rank.dc.html, reference/Weekly-rank.png.
const PODIUM_COLOR: Record<1 | 2 | 3, string> = { 1: "var(--sun)", 2: "var(--border-strong)", 3: "#f0c9a4" };
const PODIUM_HEIGHT: Record<1 | 2 | 3, number> = { 1: 150, 2: 110, 3: 80 };
const PODIUM_DELAY: Record<1 | 2 | 3, number> = { 1: 0.35, 2: 0.15, 3: 0.05 };
const PODIUM_XP_DELAY: Record<1 | 2 | 3, number> = { 1: 1.2, 2: 1, 3: 0.8 };

function PodiumColumn({ entry }: { entry: WeeklyRankPodiumEntry }) {
  const xp = useCountUp(entry.score, { delay: PODIUM_XP_DELAY[entry.rank] * 1000, duration: 700 });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      {entry.rank === 1 && (
        <svg className="mo-crown" viewBox="0 0 128 60" width="56" height="26" aria-hidden="true" style={{ marginBottom: -4 }}>
          <path d="M10 56 L18 12 L42 36 L64 4 L86 36 L110 12 L118 56 Z" fill="var(--sun)" stroke="var(--sun-text)" strokeWidth="4" strokeLinejoin="round" />
        </svg>
      )}
      <div
        className="mo-dpop"
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: "var(--sky)",
          color: "#fff",
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animationDelay: `${PODIUM_DELAY[entry.rank]}s`,
        }}
      >
        {entry.initial}
      </div>
      <span style={{ marginTop: 6, fontWeight: 700, fontSize: 13 }}>{entry.name}</span>
      <span style={{ fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{xp}</span>
      <div
        className="mo-growbar"
        style={{
          marginTop: 6,
          width: "100%",
          maxWidth: 76,
          height: PODIUM_HEIGHT[entry.rank],
          borderRadius: "12px 12px 0 0",
          background: PODIUM_COLOR[entry.rank],
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 8,
          fontWeight: 900,
          fontSize: 20,
        }}
      >
        {entry.rank}
      </div>
    </div>
  );
}

export function WeeklyRankScreen({ moment, onClose }: { moment: WeeklyRankMoment; onClose: () => void }) {
  const podiumOrder: WeeklyRankPodiumEntry[] = [2, 1, 3]
    .map((r) => moment.podium.find((p) => p.rank === r))
    .filter((p): p is WeeklyRankPodiumEntry => Boolean(p));

  return (
    <MomentScreen
      title={`Ты на ${moment.myRank} месте!`}
      onClose={onClose}
      footerDelay={1.6}
      footer={
        <Button
          className="mo-cta"
          onClick={onClose}
          style={{ ["--btn-fill" as string]: "var(--color-forest)", ["--btn-edge" as string]: "var(--color-forest-text)", ["--btn-label" as string]: "#fff" }}
        >
          Новая неделя уже началась
        </Button>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 20 }}>
        <p className="mo-muted" style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "var(--sky-text)" }}>
          Рейтинг недели · {moment.weekLabel}
        </p>
        {moment.xpGapToNextTier != null && (
          <p className="mo-rise" style={{ margin: "4px 28px 0", fontSize: 15, fontWeight: 600, animationDelay: "0.2s" }}>
            До бронзы не хватило {moment.xpGapToNextTier} XP
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, margin: "24px 20px 0" }}>
        {podiumOrder.map((entry) => (
          <PodiumColumn key={entry.rank} entry={entry} />
        ))}
      </div>

      <div className="mo-cardin" style={{ margin: "20px 20px 0", display: "flex", flexDirection: "column", gap: 8, animationDelay: "0.6s" }}>
        <div
          className="mo-glowpulse mo-card"
          style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--color-forest-tint)", border: "2px solid var(--color-forest)" }}
        >
          <span style={{ fontWeight: 900, width: 20, textAlign: "center" }}>{moment.myRank}</span>
          <span style={{ width: 36, height: 36, borderRadius: 999, background: "var(--color-forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            Ты
          </span>
          <span style={{ fontWeight: 700, flex: 1 }}>Ты</span>
          <span style={{ fontWeight: 900 }}>{moment.myScore}</span>
        </div>
        {moment.rowBelow && (
          <div className="mo-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 900, width: 20, textAlign: "center" }}>{moment.rowBelow.rank}</span>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: "var(--border-strong)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {moment.rowBelow.initial}
            </span>
            <span style={{ fontWeight: 700, flex: 1 }}>{moment.rowBelow.name}</span>
            <span style={{ fontWeight: 900 }}>{moment.rowBelow.score}</span>
          </div>
        )}
      </div>
    </MomentScreen>
  );
}
