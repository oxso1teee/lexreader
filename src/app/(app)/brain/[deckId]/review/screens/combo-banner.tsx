"use client";

import { useReducedMotion } from "motion/react";
import { Confetti } from "@/components/product/moments/confetti";

// Эталон: docs/moments/mockups/Combo.dc.html, reference/Combo.png — тост
// падает сверху поверх вопроса, по нему пробегает блик, справа выглядывает
// маскот. Не модальный (не трогает фокус/Esc) — вопрос под ним доступен.
// Позиционирование и анимация — на разных элементах: keyframes с transform
// перетирали translateX(-50%), и тост уезжал за правый край.
export function ComboBanner({ combo, xpAwarded }: { combo: number; xpAwarded: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <div
        role="status"
        style={{ position: "fixed", left: 0, right: 0, top: "calc(64px + env(safe-area-inset-top))", zIndex: 30, display: "flex", justifyContent: "center", padding: "0 28px", pointerEvents: "none" }}
      >
        <div className="cb-drop" style={{ position: "relative", width: "100%", maxWidth: 334 }}>
          <div
            style={{
              position: "relative",
              borderRadius: 24,
              background: "var(--ember)",
              boxShadow: "inset 0 -6px 0 0 var(--ember-edge)",
              padding: "16px 18px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: "#1a1a1a",
              overflow: "hidden",
            }}
          >
            <span className="cb-sweep" aria-hidden="true" />
            <div className="cb-flick" style={{ flex: "none", position: "relative" }}>
              <svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="#fff" />
                <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
              </svg>
            </div>
            <div style={{ position: "relative" }}>
              <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>
                {combo} верных подряд!
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Полоска горит · +{xpAwarded} XP</div>
            </div>
          </div>
          {!reduceMotion && <Confetti seed={combo} count={14} delay={0.7} reach={[90, 70]} fall={30} style={{ left: 50, top: 46 }} />}
        </div>
      </div>
      <div className="cb-peek" style={{ position: "fixed", right: -18, top: "52%", zIndex: 29, pointerEvents: "none" }} aria-hidden="true">
        <div className="cb-wob">
          <svg viewBox="0 0 128 150" width="110" height="128">
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
            <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
            <path d="M50 62q4-5 8 0M62 62q4-5 8 0" fill="none" stroke="var(--leaf-edge)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M52 70q8 10 16 0z" fill="var(--leaf-edge)" />
            <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
          </svg>
        </div>
      </div>
    </>
  );
}
