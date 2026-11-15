"use client";

import { useEffect } from "react";
import Link from "next/link";
import { categoryLabel } from "@/components/product/language-twin/badges";
import type { PatternCategory } from "@/lib/language-twin/types";
import type { PlacementRange, PlacementResult, SelfReportedCefr } from "@/lib/placement/types";
import { Confetti } from "@/components/product/moments/confetti";
import { Card } from "@/components/ui/card";
import { track } from "@/lib/posthog-client";

// Эталон: docs/moments/mockups/Placement-result.dc.html. Терминальное
// действие онбординга теперь не Learning Path (confirmPathAction удалён —
// он был только здесь) — путь /learning-paths полностью самодостаточен
// (своя рекомендация в getCatalogAction, достижим из /library), поэтому
// онбординг просто продолжается на Goal-pick. recommendPathFromPlacement
// больше не вызывается здесь, сам файл recommendation.ts не тронут.
const SCALE = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function highlightedLevels(range: PlacementRange): Set<string> {
  switch (range) {
    case "A1–A2":
      return new Set(["A1", "A2"]);
    case "A2–B1":
      return new Set(["A2", "B1"]);
    case "B1–B2":
      return new Set(["B1", "B2"]);
    case "B2+":
      return new Set(["B2"]);
  }
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} aria-hidden="true">
      <path d="M5 12l5 5L20 7" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="var(--sun-text)" strokeWidth={3.4} strokeLinecap="round" />
    </svg>
  );
}

export default function ResultView({
  isSkipped,
  result,
  hasConflict,
  selfReportedCefr,
}: {
  isSkipped: boolean;
  result: PlacementResult | null;
  hasConflict: boolean;
  selfReportedCefr: SelfReportedCefr | null;
}) {
  useEffect(() => {
    track("placement_result_viewed", { is_skipped: isSkipped, range: result?.range ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lit = highlightedLevels(result?.range ?? "A2–B1");
  const strong = result?.strongCategories.slice(0, 2) ?? [];
  const weak = result?.weakCategories.slice(0, 2) ?? [];

  return (
    <div className="onb-screen relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-16 text-center">
      {!isSkipped && result && (
        <div className="relative mx-auto h-0 w-0" style={{ top: 90 }}>
          <Confetti seed={13} count={26} />
        </div>
      )}

      <div className="mo-breathe mx-auto">
        <svg viewBox="0 0 128 150" width={96} height={112} aria-hidden="true">
          <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
          <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
          <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
          <path d="M50 62q4-5 8 0M62 62q4-5 8 0" fill="none" stroke="var(--leaf-deep)" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M52 70q8 10 16 0z" fill="var(--leaf-deep)" />
          <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
          <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
        </svg>
      </div>

      <p className="mo-rise mt-2 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {isSkipped ? "Диагностика пропущена" : "Мини-тест пройден"}
      </p>
      <h1 className="mo-rise mt-1.5 text-2xl font-black leading-tight" style={{ animationDelay: "0.1s" }}>
        Твой уровень
      </h1>

      <div
        className="mo-pop mx-auto mt-2.5 inline-block rounded-2xl px-5 py-2 text-4xl font-black text-white"
        style={{ background: "var(--leaf)", boxShadow: "inset 0 -6px 0 0 var(--leaf-edge)" }}
      >
        {isSkipped ? (selfReportedCefr && selfReportedCefr !== "unsure" ? selfReportedCefr : "?") : result?.range}
      </div>

      <div className="mo-rise mt-5" role="img" aria-label={`Шкала уровней от A1 до C2, твой уровень ${result?.range ?? "неизвестен"}`}>
        <div className="flex gap-1.5">
          {SCALE.map((level) => {
            const isLit = !isSkipped && lit.has(level);
            return (
              <span
                key={level}
                className="flex h-11 flex-1 items-center justify-center rounded-xl font-black"
                style={
                  isLit
                    ? { background: "var(--leaf)", color: "#fff", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }
                    : { background: "var(--surface-muted)", color: "var(--text-secondary)" }
                }
              >
                {level}
              </span>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-xs font-semibold text-[var(--text-secondary)]">
          <span>новичок</span>
          <span>свободно</span>
        </div>
      </div>

      {isSkipped ? (
        <Card className="mo-rise mt-4 px-4 py-3 text-left text-sm text-[var(--text-secondary)]">
          Диагностику ты пропустил(а) — выше показана твоя само-оценка. Пройти
          диагностику можно в любой момент позже, из Settings.
        </Card>
      ) : (
        <div className="mo-rise mt-4 rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-left">
          {hasConflict && selfReportedCefr && selfReportedCefr !== "unsure" && (
            <p className="border-b border-[var(--border)] py-2 text-sm text-[var(--text-secondary)]">
              Несколько базовых навыков пока нестабильны — перед более сложными темами стоит немного укрепить фундамент.
            </p>
          )}
          {strong.map((c) => (
            <div key={c} className="flex items-start gap-2.5 border-b border-[var(--border)] py-2 text-sm">
              <span className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full" style={{ background: "var(--leaf)" }}>
                <CheckIcon />
              </span>
              {categoryLabel(c as PatternCategory)}
            </div>
          ))}
          {weak.map((c, i) => (
            <div key={c} className={`flex items-start gap-2.5 py-2 text-sm ${i < weak.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
              <span className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full" style={{ background: "var(--sun-tint)" }}>
                <PlusIcon />
              </span>
              Подтянем: {categoryLabel(c as PatternCategory)}
            </div>
          ))}
        </div>
      )}

      <div className="mo-rise mt-auto pt-6" style={{ animationDelay: "0.3s" }}>
        <Link
          href="/onboarding/goal"
          className="focus-ring flex min-h-[54px] w-full items-center justify-center rounded-2xl px-5 font-bold text-white"
          style={{ background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }}
        >
          Подобрать тексты под {isSkipped ? (selfReportedCefr && selfReportedCefr !== "unsure" ? selfReportedCefr : "твой уровень") : result?.range}
        </Link>
      </div>
    </div>
  );
}
