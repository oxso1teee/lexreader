"use client";

import { useReducedMotion } from "motion/react";
import { Confetti } from "@/components/product/moments/confetti";

// docs/moments/mockups/Combo.dc.html, reference/Combo.png — в макете это
// тост поверх вопроса. Полная шапка макета (X / горизонтальная полоса /
// пламя-комбо) здесь не переверстана — этап 3 добавляет Combo "поверх
// текущего повторения карточек" (формулировка задачи), а не меняет сам
// хидер cards-режима; "полоса стала оранжевой" реализована как смена цвета
// уже существующих точек прогресса (review-session.tsx), не отдельной
// полосой. Тост не модальный (не трогает фокус/Esc) — вопрос под ним
// остаётся доступен, как и в макете.
export function ComboBanner({ combo, xpAwarded }: { combo: number; xpAwarded: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        left: "50%",
        top: 8,
        width: "calc(100% - 32px)",
        maxWidth: 360,
        transform: "translateX(-50%)",
        zIndex: 20,
        animation: reduceMotion ? undefined : "mo-rise 0.4s cubic-bezier(.2,.9,.3,1.2) both",
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 24,
          background: "var(--sun)",
          boxShadow: "inset 0 -6px 0 0 var(--sun-edge)",
          padding: "14px 16px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          color: "#1a1a1a",
          overflow: "hidden",
        }}
      >
        <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" style={{ flex: "none" }}>
          <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="#fff" />
          <path
            d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z"
            fill="#ffc700"
          />
        </svg>
        <div>
          <div className="mo-disp" style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.1 }}>
            {combo} верных подряд!
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>+{xpAwarded} XP</div>
        </div>
        {!reduceMotion && <Confetti seed={combo} count={14} delay={0.15} reach={[70, 60]} fall={30} style={{ left: 36, top: 24 }} />}
      </div>
    </div>
  );
}
