"use client";

import { Button } from "@/components/ui/button";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { AchievementMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Achievement.dc.html, reference/Achievement.png.
// "УРОВЕНЬ 2" внутри значка и прогресс-бар "До уровня 3: X/25 глав" из
// макета убраны — у достижений в src/lib/achievements.ts нет ступеней
// (получено/не получено, без промежуточных уровней), нечего показать
// настоящего. Нижний ряд иконок — реальные ДРУГИЕ достижения из каталога, а
// не выдуманные.
export function AchievementScreen({ moment, onClose }: { moment: AchievementMoment; onClose: () => void }) {
  const achievement = ACHIEVEMENTS.find((a) => a.id === moment.achievementId);
  if (!achievement) return null;
  const others = ACHIEVEMENTS.filter((a) => a.id !== moment.achievementId);

  return (
    <MomentScreen
      title="Новое достижение"
      onClose={onClose}
      footerDelay={1.9}
      footer={
        <Button variant="leaf" className="mo-cta" onClick={onClose}>
          Круто!
        </Button>
      }
    >
      <div
        className="mo-rise"
        style={{
          textAlign: "center",
          paddingTop: 64,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          // var(--sky-text) на var(--background) даёт только 4.26:1 в светлой
          // теме (axe-core, e2e/unified-shell-a11y.spec.ts) — см.
          // --sky-text-strong в moments.css (темнее только в светлой теме,
          // тёмная не трогается — там и так 11.2:1).
          color: "var(--sky-text-strong)",
          animationDelay: "0.2s",
        }}
      >
        Новое достижение
      </div>

      <div style={{ position: "relative", height: 290, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14 }}>
        <svg className="mo-spin" viewBox="0 0 300 300" width="300" height="300" aria-hidden="true" style={{ position: "absolute", opacity: 0.7, animationDuration: "18s" }}>
          <g fill="var(--sky-tint)">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <path key={deg} d="M150 150 L140 0 L160 0 Z" transform={`rotate(${deg} 150 150)`} />
            ))}
          </g>
        </svg>
        <svg className="mo-tw" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style={{ position: "absolute", left: 64, top: 40, animationDelay: "1s" }}>
          <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--sun)" />
        </svg>
        <svg className="mo-tw" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ position: "absolute", right: 70, top: 70, animationDelay: "1.4s" }}>
          <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--sky)" />
        </svg>
        <svg className="mo-tw" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ position: "absolute", right: 84, bottom: 30, animationDelay: "1.8s" }}>
          <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--sun)" />
        </svg>
        <div className="mo-flip">
          <div className="mo-hover" style={{ position: "relative", width: 200, height: 220 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                background: "#075a85",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "10px 9px",
                clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                background: "#0b79b0",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <span aria-hidden="true" className="mo-shine" style={{ position: "absolute", top: -40, width: 40, height: 280, background: "rgba(255,255,255,.55)" }} />
              <achievement.icon aria-hidden="true" style={{ width: 70, height: 70, strokeWidth: 1.8 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 28px" }}>
        <h2 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: "0.9s" }}>
          {achievement.title}
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 0 0", fontSize: 16, animationDelay: "1s" }}>
          {achievement.description}
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "22px 20px 0", padding: "14px 16px", animationDelay: "1.15s" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {others.slice(0, 3).map((a, i) => (
            <div
              key={a.id}
              className="mo-mp"
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: "var(--surface-muted)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animationDelay: `${1.6 + i * 0.1}s`,
              }}
            >
              <a.icon aria-hidden="true" style={{ width: 26, height: 26 }} />
            </div>
          ))}
          <div className="mo-muted" style={{ fontSize: 13, flex: 1, textAlign: "right" }}>
            Ещё {others.length} {others.length % 10 === 1 && others.length % 100 !== 11 ? "достижение" : [2, 3, 4].includes(others.length % 10) && ![12, 13, 14].includes(others.length % 100) ? "достижения" : "достижений"}
            <br />в профиле
          </div>
        </div>
      </div>
    </MomentScreen>
  );
}
