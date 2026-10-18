"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { EarnBackMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Earn-back.dc.html, reference/Earn-back.png.
// Ссылка "Начать новую серию" ведёт на /brain (нейтральный хаб практики) —
// макет линкует на Main.dc.html, у нас это тот же смысл: закрыть момент и
// продолжить без восстановления.
export function EarnBackScreen({ moment, onClose }: { moment: EarnBackMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title="Стрик прервался"
      onClose={onClose}
      footerDelay={1.3}
      footer={
        <div style={{ width: "100%" }}>
          <Button
            className="mo-cta"
            onClick={onClose}
            style={{ ["--btn-fill" as string]: "var(--ember-text)", ["--btn-edge" as string]: "#9a330a", ["--btn-label" as string]: "#fff" }}
          >
            Вернуть стрик · день 1
          </Button>
          <button
            type="button"
            onClick={onClose}
            style={{ display: "block", width: "100%", textAlign: "center", font: "600 15px/1 var(--font-onest), sans-serif", color: "var(--text-secondary)", padding: "16px 0 0", textDecoration: "underline", background: "none", border: 0, cursor: "pointer" }}
          >
            Начать новую серию
          </button>
        </div>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 140 }}>
        <div style={{ position: "relative", display: "inline-block", width: 170, height: 180 }}>
          <span className="mo-smoke" style={{ ["--dx" as string]: "-14px" } as CSSProperties} aria-hidden="true" />
          <span className="mo-smoke" style={{ ["--dx" as string]: "10px", animationDelay: "0.9s" } as CSSProperties} aria-hidden="true" />
          <span className="mo-smoke" style={{ ["--dx" as string]: "-4px", animationDelay: "1.8s" } as CSSProperties} aria-hidden="true" />
          <div className="mo-glow-dim" aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: 20, width: 90, height: 90, marginLeft: -45, borderRadius: 999, background: "var(--ember)" }} />
          <div className="mo-sink" style={{ position: "absolute", left: 5, top: 18 }}>
            <svg viewBox="0 0 24 24" width="160" height="160" aria-hidden="true">
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--border-strong)" />
            </svg>
          </div>
          <svg viewBox="0 0 24 24" width="160" height="160" aria-hidden="true" style={{ position: "absolute", left: 5, top: 18 }}>
            <path
              className="mo-ember-flicker"
              d="M12 14c.6 1.6 2.4 2.4 2.4 4.4a2.4 2.4 0 0 1-4.8 0c0-1.2.8-2 1.2-2.8.2.8.6 1.2 1 1.2 0-1.2-.3-2 .2-2.8z"
              fill="var(--ember)"
            />
          </svg>
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "18px 24px 0", fontSize: 26, lineHeight: 1.2, fontWeight: 900, animationDelay: "0.6s" }}>
          Стрик прервался
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 30px 0", fontSize: 16, lineHeight: 1.45, animationDelay: "0.72s" }}>
          Было <b style={{ color: "var(--foreground)" }}>{moment.streakBeforeBreak} дней</b>. Огонёк ещё тлеет: позанимайся 3 дня подряд, и все {moment.streakBeforeBreak} дней вернутся.
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "26px 20px 0", padding: 16, animationDelay: "0.9s" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div
              className="mo-stepring"
              style={{
                width: 50,
                height: 50,
                borderRadius: 999,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "700 16px/1 var(--font-unbounded), sans-serif",
                background: "var(--surface)",
                border: "3px dashed var(--ember)",
                color: "var(--ember-text)",
              }}
            >
              1
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: "var(--ember-text)" }}>Сегодня</div>
          </div>
          <div className="mo-draw" style={{ flex: "0 0 24px", height: 3, background: "var(--surface-muted)", marginTop: 25, borderRadius: 9, animationDelay: "1.05s" }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ width: 50, height: 50, borderRadius: 999, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", font: "700 16px/1 var(--font-unbounded), sans-serif", background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
              2
            </div>
            <div className="mo-muted" style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              Завтра
            </div>
          </div>
          <div className="mo-draw" style={{ flex: "0 0 24px", height: 3, background: "var(--surface-muted)", marginTop: 25, borderRadius: 9, animationDelay: "1.15s" }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ width: 50, height: 50, borderRadius: 999, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-muted)" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--text-secondary)" opacity="0.5" />
              </svg>
            </div>
            <div className="mo-muted" style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              Снова {moment.streakBeforeBreak}
            </div>
          </div>
        </div>
      </div>
    </MomentScreen>
  );
}
