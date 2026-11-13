"use client";

import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { StreakMilestoneMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Streak-30.dc.html, reference/Streak-30.png.
// Кнопка "Поделиться" из макета убрана — у приложения нет реального
// share-механизма для стрика (api/*/share-card генерирует OG-картинку для
// превью ссылок, не пользовательскую кнопку "Поделиться").
function rain(): CSSProperties[] {
  let s = 31;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const cols = ["var(--sun)", "#fff", "var(--sky)", "var(--leaf-tint-strong)", "#ffd9a3"];
  return Array.from({ length: 22 }, (_, i) => {
    const w = 7 + Math.round(r() * 6);
    return {
      left: Math.round(r() * 380),
      width: w,
      height: Math.round(w * (1.2 + r())),
      background: cols[i % cols.length],
      borderRadius: i % 4 === 0 ? 99 : 2,
      ["--t" as string]: `${(3 + r() * 2.5).toFixed(2)}s`,
      ["--d" as string]: `${(r() * 3).toFixed(2)}s`,
      ["--r" as string]: `${Math.round(r() * 900 - 450)}deg`,
    } as CSSProperties;
  });
}
const RAIN = rain();

export function Streak30Screen({ moment, onClose }: { moment: StreakMilestoneMoment; onClose: () => void }) {
  const n = useCountUp(moment.milestone, { delay: 300, duration: 1200 });
  const [copied, setCopied] = useState(false);
  async function share() {
    const text = `${moment.milestone} дней подряд читаю в LexReader без пропусков.`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Отмена шаринга — не ошибка.
    }
  }

  return (
    <MomentScreen
      title={`${moment.milestone} дней подряд`}
      background="var(--ember-text)"
      foreground="#fff"
      onClose={onClose}
      footerDelay={2}
      footer={
        <div style={{ display: "flex", gap: 12 }}>
          <Button
            onClick={share}
            style={{ flex: 1, gap: 8, ["--btn-fill" as string]: "rgba(255,255,255,.18)", ["--btn-edge" as string]: "rgba(0,0,0,.15)", ["--btn-label" as string]: "#fff" } as CSSProperties}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            {copied ? "Скопировано" : "Поделиться"}
          </Button>
          <Button
            onClick={onClose}
            style={{ flex: 1, ["--btn-fill" as string]: "#fff", ["--btn-edge" as string]: "#ffd9a3", ["--btn-label" as string]: "var(--ember-text)" } as CSSProperties}
          >
            Продолжить
          </Button>
        </div>
      }
    >
      {RAIN.map((p, i) => (
        <span key={i} className="mo-fall" style={p} aria-hidden="true" />
      ))}

      <div style={{ position: "relative", textAlign: "center", paddingTop: 70 }}>
        <div
          className="mo-glow-breathe"
          aria-hidden="true"
          style={{ position: "absolute", left: "50%", top: 92, width: 210, height: 210, marginLeft: -105, borderRadius: 999, background: "var(--ember)" }}
        />
        <div className="mo-enter" style={{ position: "relative", display: "inline-block" }}>
          <svg className="mo-crown" viewBox="0 0 128 60" width="96" height="45" aria-hidden="true" style={{ display: "block", margin: "0 auto -8px" }}>
            <path d="M10 56 L18 12 L42 36 L64 4 L86 36 L110 12 L118 56 Z" fill="var(--sun)" stroke="var(--sun-text)" strokeWidth="4" strokeLinejoin="round" />
            <circle cx="64" cy="4" r="5" fill="#fff" />
            <circle cx="18" cy="12" r="4" fill="#fff" />
            <circle cx="110" cy="12" r="4" fill="#fff" />
          </svg>
          <div style={{ animation: "mo-rise 0.45s cubic-bezier(.2,.8,.2,1) both, mo-bob 2.4s 1.4s ease-in-out infinite" }}>
            <svg viewBox="0 0 128 150" width="150" height="176" aria-hidden="true">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf-tint-strong)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="#fff" opacity="0.9" />
              <path d="M50 62q4-5 8 0M62 62q4-5 8 0" fill="none" stroke="var(--leaf-deep)" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M52 70q8 10 16 0z" fill="var(--leaf-deep)" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--sun)" transform="rotate(-28 90 100)" />
              <ellipse cx="94" cy="96" rx="8" ry="5" fill="#fff" transform="rotate(-28 94 96)" opacity="0.85" />
            </svg>
          </div>
        </div>
        <div className="mo-disp mo-slot" style={{ position: "relative", fontSize: 120, fontWeight: 900, lineHeight: 0.95, marginTop: 4 }} aria-label={String(moment.milestone)}>
          {n}
        </div>
        <div className="mo-disp mo-rise" style={{ position: "relative", fontSize: 26, fontWeight: 700, animationDelay: "0.4s" }}>
          дней подряд
        </div>
        <p className="mo-rise" style={{ position: "relative", margin: "14px 28px 0", fontSize: 17, lineHeight: 1.4, fontWeight: 600, animationDelay: "1.5s" }}>
          Месяц без единого пропуска. Привычка уже твоя.
        </p>
      </div>

      {/* Макет просит rgba(255,255,255,.16) — белый текст поверх этого стекла
          даёт только 3.99:1 (axe-core, e2e/unified-shell-a11y.spec.ts нашла
          тот же класс проблемы в .td-hero). .08 держит тот же стеклянный вид
          с запасом (4.57:1) выше порога 4.5:1. */}
      <div className="mo-slidein" style={{ position: "relative", margin: "24px 20px 0", borderRadius: 20, background: "rgba(255,255,255,.08)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--sky-tint)", color: "var(--sky-text)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" />
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Награда: +1 заморозка</div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            {moment.nextMilestone ? `Следующий рубеж: ${moment.nextMilestone} дней` : "Это последний рубеж — дальше просто рекорды"}
          </div>
        </div>
      </div>
    </MomentScreen>
  );
}
