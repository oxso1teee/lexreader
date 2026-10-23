"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { DuelState } from "@/lib/duel";
import { Button } from "@/components/ui/button";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Duel-invite.dc.html, reference/Duel-invite.png:
// окно по центру поверх приложения, вспышка, аватары съезжаются, «VS» с
// искрами, две строки условий, «Позже» / «Принять вызов», живой таймер.
// Данные реальные: инициалы соперника, число раундов, invite_expires_at.
// Дуэли не привязаны к книге (общий частотный пул) — строка про «слова из
// книги» заменена на честное «N слов из частотного списка».
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

const SPARKS: CSSProperties[] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return {
    ["--dx" as string]: `${Math.round(Math.cos(a) * 70)}px`,
    ["--dy" as string]: `${Math.round(Math.sin(a) * 50)}px`,
    marginLeft: -4,
    background: i % 2 ? "var(--sun)" : "var(--ember)",
  } as CSSProperties;
});

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
  // null до монтирования: сервер и браузер рендерят одно и то же (без
  // Date.now() в первом рендере — иначе рассинхрон гидрации).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, []);

  const expiresAtMs = state.inviteExpiresAt ? new Date(state.inviteExpiresAt).getTime() : null;
  const remaining = expiresAtMs != null && nowMs != null ? formatCountdown(expiresAtMs - nowMs) : null;
  const opponent = state.isCreator ? state.opponentInitials ?? "?" : state.creatorInitials;

  return (
    <MomentScreen
      variant="modal"
      title="Приглашение на дуэль"
      onClose={onDecline}
      footerDelay={1.35}
      footer={
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Button
              disabled={busy}
              onClick={onDecline}
              className="mo-cta"
              style={{ ["--btn-fill" as string]: "var(--surface-muted)", ["--btn-edge" as string]: "#d6cfc3", ["--btn-label" as string]: "var(--foreground)", flex: "0 0 auto", width: "auto", paddingLeft: 18, paddingRight: 18 }}
            >
              Позже
            </Button>
            <Button disabled={busy} onClick={onAccept} className="mo-cta" style={{ flex: 1 }}>
              {busy ? "…" : "Принять вызов"}
            </Button>
          </div>
          {remaining && (
            <div className="mo-muted" style={{ textAlign: "center", fontSize: 12, marginTop: 10 }}>
              Вызов сгорит через <b style={{ fontVariantNumeric: "tabular-nums", color: "var(--ember-text)" }}>{remaining}</b>
            </div>
          )}
        </>
      }
    >
      <span className="di-flash" aria-hidden="true" />
      {SPARKS.map((st, i) => (
        <span key={i} className="di-spk" style={st} aria-hidden="true" />
      ))}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, position: "relative" }}>
        <div className="di-sl" style={{ textAlign: "center" }}>
          <div className="di-av" style={{ background: "#8b5cf6", ["--c" as string]: "rgba(139,92,246,.5)" } as CSSProperties} aria-hidden="true">
            {opponent}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>Соперник</div>
        </div>
        <div className="mo-disp di-vs" style={{ width: 64, textAlign: "center", fontSize: 24, fontWeight: 900, color: "var(--ember-text)" }} aria-hidden="true">
          VS
        </div>
        <div className="di-sr" style={{ textAlign: "center" }}>
          <div className="di-av" style={{ background: "#0b79b0", ["--c" as string]: "rgba(11,121,176,.5)" } as CSSProperties} aria-hidden="true">
            Ты
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>Ты</div>
        </div>
      </div>
      <h2 className="mo-disp mo-rise" style={{ margin: "20px 0 0", textAlign: "center", fontSize: 22, lineHeight: 1.2, fontWeight: 900, animationDelay: "1s" }}>
        {opponent} вызывает тебя на дуэль
      </h2>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="mo-rise" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--background)", fontSize: 14, animationDelay: "1.1s" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ fill: "none", stroke: "var(--sky-text)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }}>
            <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" />
            <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
          </svg>
          {state.roundCount} слов из частотного списка
        </div>
        <div className="mo-rise" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--background)", fontSize: 14, animationDelay: "1.2s" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ fill: "none", stroke: "var(--sky-text)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          Засчитывается только верно и в срок
        </div>
      </div>
    </MomentScreen>
  );
}
