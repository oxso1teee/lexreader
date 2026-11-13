"use client";

import { ButtonLink } from "@/components/ui/button";
import type { TwinInsightMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Twin-insight.dc.html, reference/Twin-insight.png:
// маскот-двойник с ореолом, заголовок, карточка навыков, жёлтый «Фокус на
// неделю». Числовой оценки навыка в базе нет (паттерны хранят тренд и
// уверенность), поэтому вместо полос с выдуманными процентами — тот же ряд
// с настоящим трендом: растёт / ровно / спад.
const TREND = {
  up: { text: "↑ растёт", bg: "var(--leaf-tint)", fg: "var(--leaf-text)" },
  flat: { text: "→ ровно", bg: "var(--surface-muted)", fg: "var(--text-secondary)" },
  down: { text: "↓ спад", bg: "var(--danger-tint)", fg: "var(--danger-text)" },
} as const;

export function TwinInsightScreen({ moment, onClose }: { moment: TwinInsightMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title="Мой английский: оценка обновилась"
      haptic="light"
      onClose={onClose}
      footerDelay={2.4}
      footer={
        <ButtonLink href="/language-twin" onClick={onClose} className="mo-cta">
          {moment.focusLabel ? "Потренировать фокус" : "Открыть «Мой английский»"}
        </ButtonLink>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 56 }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", width: 150, height: 120 }}>
          <div className="ti-twin" style={{ ["--x" as string]: "-40px", position: "absolute", left: 14, top: 8, opacity: 0.45 }} aria-hidden="true">
            <svg viewBox="0 0 128 150" width="82" height="96">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--sky)" />
            </svg>
          </div>
          <div className="ti-twin ti-halo" style={{ ["--x" as string]: "40px", position: "relative", borderRadius: 999, padding: 6, background: "var(--sky-tint)" }} aria-hidden="true">
            <svg viewBox="0 0 128 150" width="82" height="96">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
              <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
              <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
              <path d="M54 72q6 5 12 0" fill="none" stroke="var(--leaf-edge)" strokeWidth="2.4" strokeLinecap="round" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            </svg>
          </div>
        </div>
        <div className="mo-rise" style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sky-text)", marginTop: 8, animationDelay: ".5s" }}>
          Мой английский · {moment.weekLabel}
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "6px 24px 0", fontSize: 23, lineHeight: 1.2, fontWeight: 900, animationDelay: ".6s" }}>
          Оценка обновилась
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "6px 30px 0", fontSize: 15, animationDelay: ".7s" }}>
          По твоим занятиям и чтению за неделю
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "16px 20px 0", padding: "4px 16px", animationDelay: ".8s" }}>
        {moment.skills.map((k, i) => {
          const t = TREND[k.trend];
          return (
            <div
              key={k.category}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", fontSize: 15, fontWeight: 700, borderBottom: i < moment.skills.length - 1 ? "2px solid var(--surface-muted)" : undefined }}
            >
              <span>{k.label}</span>
              <span className="ti-delta" style={{ background: t.bg, color: t.fg, ["--d" as string]: `${1.6 + i * 0.15}s` }}>
                {t.text}
              </span>
            </div>
          );
        })}
      </div>

      {moment.focusLabel && (
        <div className="mo-rise" style={{ margin: "12px 20px 0", padding: "12px 14px", borderRadius: 18, background: "var(--sun-tint)", display: "flex", gap: 12, alignItems: "flex-start", animationDelay: "2.2s" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--sun)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style={{ fill: "none", stroke: "#4d3800", strokeWidth: 2.4, strokeLinecap: "round" }}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sun-text)", textTransform: "uppercase", letterSpacing: ".05em" }}>Фокус на неделю</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, color: "#4d3800" }}>{moment.focusLabel}</div>
          </div>
        </div>
      )}
    </MomentScreen>
  );
}
