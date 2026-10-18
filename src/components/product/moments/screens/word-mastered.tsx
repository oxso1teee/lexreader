"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { WordMasteredMoment } from "@/lib/moments/types";
import { Confetti } from "../confetti";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Word-mastered.dc.html, reference/Word-mastered.png.
// Фонетическая транскрипция из макета убрана — у flashcards нет такого поля
// (данные только настоящие). CTA — "Продолжить" вместо макетного "Дальше
// читать": этот момент сейчас приходит и из повторения в Мозге, не только из
// читалки (reviewWord(), см. docs/moments/ROADMAP.md этап 1), макетный текст
// предполагал бы читалку, которой тут может и не быть.
const LABELS = ["Новое", "Учу", "Знакомо", "Знаю"];
const LEAF_COLORS = ["var(--leaf)", "var(--leaf-edge)", "var(--leaf)"];

function timesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "раза";
  return "раз";
}

export function WordMasteredScreen({ moment, onClose }: { moment: WordMasteredMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title="Слово выучено"
      onClose={onClose}
      footerDelay={3}
      footer={
        <Button variant="leaf" className="mo-cta" onClick={onClose}>
          Продолжить
        </Button>
      }
    >
      <div style={{ position: "relative", paddingTop: 110, display: "flex", justifyContent: "center" }}>
        <Confetti seed={71} count={22} delay={2.4} reach={[130, 90]} fall={0} shape="leaf" colors={["var(--leaf)", "var(--leaf-tint-strong)", "var(--sun)", "var(--leaf-edge)"]} style={{ left: "50%", top: 220 }} />
        <div className="mo-cardin" style={{ position: "relative" }}>
          <div
            className="mo-stage"
            style={{
              width: 280,
              padding: "26px 24px",
              borderRadius: 26,
              border: "3px solid var(--sky)",
              boxShadow: "inset 0 -6px 0 0 rgba(0,0,0,.08)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 38, fontWeight: 700, fontStyle: "italic", lineHeight: 1.1 }}>{moment.front}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>{moment.back}</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }} aria-label="Уровень знания 4 из 4">
              <span className="mo-lvfill" style={{ width: 28, height: 10, borderRadius: 99, ["--d" as string]: "0.9s" } as CSSProperties} />
              <span className="mo-lvfill" style={{ width: 28, height: 10, borderRadius: 99, ["--d" as string]: "1.3s" } as CSSProperties} />
              <span className="mo-lvfill" style={{ width: 28, height: 10, borderRadius: 99, ["--d" as string]: "1.8s" } as CSSProperties} />
              <span className="mo-lvfill" style={{ width: 28, height: 10, borderRadius: 99, ["--d" as string]: "2.3s" } as CSSProperties} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, padding: "0 6px", fontSize: 12, fontWeight: 700 }} aria-hidden="true">
            {LABELS.map((label) => (
              <span key={label} style={{ color: "var(--leaf-text)" }}>
                {label}
              </span>
            ))}
          </div>
          <div
            className="mo-stampin mo-disp"
            style={{
              position: "absolute",
              right: -20,
              top: -18,
              padding: "8px 14px",
              borderRadius: 12,
              border: "3px solid var(--leaf)",
              background: "var(--surface)",
              color: "var(--leaf-text)",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ЗНАЮ
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "34px 28px 0" }}>
        <h2 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 26, lineHeight: 1.2, fontWeight: 900, animationDelay: "2.5s" }}>
          Слово выучено!
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 0 0", fontSize: 16, animationDelay: "2.6s" }}>
          Встретил {moment.timesSeen} {timesWord(moment.timesSeen)}, повторил {moment.timesCorrect} {timesWord(moment.timesCorrect)}. Больше не будет в повторении
        </p>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "22px 20px 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, animationDelay: "2.8s" }}>
        <div style={{ position: "relative", width: 48, height: 48, flex: "none" }} aria-hidden="true">
          <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "0 70% 0 70%", background: LEAF_COLORS[0], left: 6, top: 16, transform: "rotate(-30deg)" }} />
          <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "0 70% 0 70%", background: LEAF_COLORS[1], left: 22, top: 6, transform: "rotate(20deg)" }} />
          <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "0 70% 0 70%", background: LEAF_COLORS[2], left: 24, top: 24, transform: "rotate(80deg)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, color: "var(--leaf-text)" }}>
            {moment.totalMastered}
          </div>
          <div className="mo-muted" style={{ fontSize: 13 }}>
            слов знаешь
          </div>
        </div>
      </div>
    </MomentScreen>
  );
}
