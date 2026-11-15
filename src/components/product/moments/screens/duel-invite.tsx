"use client";

import { useEffect, useState } from "react";
import type { DuelState } from "@/lib/duel";
import { Button } from "@/components/ui/button";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Duel-invite.dc.html, reference/Duel-invite.png.
// Отличия от макета (честная адаптация к реальной модели дуэлей, см.
// supabase/migrations/0055_duels_rewards_and_friend_streaks.sql): дуэли не
// привязаны к книге (общий NGSL-пул), а до старта раундов никто ничего не
// "решил" — поэтому убраны "10 слов из «The Last Lighthouse»" и "у Ани уже
// 8 из 10"; соперник известен только по инициалам (profiles без имени,
// 0049), поэтому заголовок обобщён.
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function DuelInviteScreen({
  state,
  onAccept,
  onDecline,
  busy,
}: {
  state: DuelState;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const expiresAtMs = state.inviteExpiresAt ? new Date(state.inviteExpiresAt).getTime() : null;
  const remaining = expiresAtMs != null ? formatCountdown(expiresAtMs - nowMs) : null;

  return (
    <MomentScreen
      title="Приглашение на дуэль"
      onClose={onDecline}
      footerDelay={0.6}
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "transparent", ["--btn-edge" as string]: "var(--border-strong)", ["--btn-label" as string]: "var(--foreground)", flex: "none", width: 110 }}
          >
            Позже
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="mo-cta"
            style={{ ["--btn-fill" as string]: "var(--color-forest)", ["--btn-edge" as string]: "var(--color-forest-text)", ["--btn-label" as string]: "#fff", flex: 1 }}
          >
            {busy ? "…" : "Принять вызов"}
          </Button>
        </div>
      }
    >
      <div style={{ position: "relative", textAlign: "center", paddingTop: 48 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div
            className="mo-mp"
            style={{ width: 64, height: 64, borderRadius: 999, background: "var(--sky)", color: "#fff", fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-hidden="true"
          >
            {state.creatorInitials}
          </div>
          <span className="mo-zoom" style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 900, color: "var(--ember-text)", fontSize: 20 }}>
            VS
          </span>
          <div
            className="mo-mp"
            style={{ width: 64, height: 64, borderRadius: 999, background: "var(--color-forest)", color: "#fff", fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-hidden="true"
          >
            Ты
          </div>
        </div>

        <h2 className="mo-rise" style={{ margin: "20px 24px 0", fontSize: 22, fontWeight: 900, animationDelay: "0.2s" }}>
          Соперник вызывает тебя на дуэль
        </h2>

        <div className="mo-rise" style={{ margin: "14px 20px 0", display: "flex", flexDirection: "column", gap: 6, animationDelay: "0.3s" }}>
          <p className="mo-muted" style={{ fontSize: 15 }}>{state.roundCount} слов из общего частотного списка</p>
          <p className="mo-muted" style={{ fontSize: 15 }}>Ответ засчитывается только вовремя и верно</p>
        </div>

        {remaining && (
          <p className="mo-rise" style={{ margin: "16px 0 0", fontSize: 14, fontWeight: 700, color: "var(--ember-text)", animationDelay: "0.4s" }}>
            Вызов сгорит через {remaining}
          </p>
        )}
      </div>
    </MomentScreen>
  );
}
