"use client";

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TwinInsightMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

const TREND_META = {
  up: { Icon: ArrowUp, color: "var(--color-forest-text)" },
  down: { Icon: ArrowDown, color: "var(--color-danger-text)" },
  flat: { Icon: ArrowRight, color: "var(--text-secondary)" },
} as const;

const STATUS_WIDTH: Record<TwinInsightMoment["skills"][number]["status"], string> = {
  weak: "30%",
  developing: "60%",
  strong: "90%",
};

// Эталон: docs/moments/mockups/Twin-insight.dc.html. Процентные бары из
// макета — настоящая confidence-ступень (low/medium/high -> 30/60/90%), не
// придуманное число; delta — реальный trend (up/down/flat) из
// recomputeLanguageTwin(). focusLabel — честный pickTopPattern(), null
// если данных ещё не набралось.
export function TwinInsightScreen({ moment, onClose }: { moment: TwinInsightMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title="Мой английский обновился"
      haptic="light"
      onClose={onClose}
      footerDelay={0.6}
      footer={
        <Button className="mo-cta" onClick={onClose}>
          {moment.focusLabel ? "Открыть «Мой английский»" : "Понятно"}
        </Button>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 72 }}>
        <p className="mo-rise" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sky-text)" }}>
          Мой английский · {moment.weekLabel}
        </p>
        <h2 className="mo-disp mo-rise" style={{ margin: "6px 24px 0", fontSize: 22, lineHeight: 1.2, fontWeight: 900 }}>
          Оценка обновилась
        </h2>
      </div>

      <div className="mo-rise" style={{ margin: "16px 20px 0", borderRadius: 20, background: "var(--surface)", border: "2px solid var(--border)", padding: "6px 16px" }}>
        {moment.skills.map((skill) => {
          const { Icon, color } = TREND_META[skill.trend];
          return (
            <div key={skill.category} style={{ padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
                <span>{skill.label}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 700, color }}>
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {skill.trend === "up" ? "рост" : skill.trend === "down" ? "спад" : "стабильно"}
                </span>
              </div>
              <div style={{ height: 12, borderRadius: 99, background: "var(--surface-muted)", overflow: "hidden", marginTop: 7 }}>
                <div style={{ height: "100%", width: STATUS_WIDTH[skill.status], borderRadius: 99, background: "var(--color-forest)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {moment.focusLabel && (
        <div className="mo-rise" style={{ margin: "12px 20px 0", padding: "12px 14px", borderRadius: 18, background: "var(--sun-tint)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sun-text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Фокус на неделю
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>{moment.focusLabel}</div>
        </div>
      )}
    </MomentScreen>
  );
}
