"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Confetti } from "@/components/product/moments/confetti";
import { useCountUp } from "@/components/product/moments/use-count-up";
import type { ExcerptToken, TextFamiliarity } from "@/lib/vocabulary/text-familiarity";

// Эталон: docs/moments/mockups/First-text.dc.html. Главы/обложка из
// мокапа (конкретная книга-пример) здесь не выдумываются — реальный
// стартовый текст один, без коллекции (нет схемы под системную коллекцию,
// см. план этапа 7), поэтому вместо "N глав" — реальные уровень и число
// слов текста.
export default function FirstTextView({
  textId,
  title,
  levelTag,
  wordCount,
  familiarity,
  excerpt = [],
}: {
  textId: string;
  title: string;
  levelTag: string | null;
  wordCount: number | null;
  familiarity: TextFamiliarity;
  /** Начало текста с пометкой новых слов (excerptWithNewWords). */
  excerpt?: ExcerptToken[];
}) {
  const pct = useCountUp(familiarity.percentFamiliar, { delay: 1300, duration: 900 });
  let markIndex = 0;
  // Длинное слово в названии не должно рваться посередине на корешке
  // шириной ~96px: уменьшаем кегль под самое длинное слово (Unbounded 900
  // в верхнем регистре ≈ 0.8em на букву).
  const longestWord = Math.max(...title.split(/\s+/).map((w) => w.length), 1);
  const titleSize = Math.max(9, Math.min(14, Math.floor(96 / (longestWord * 0.8))));

  // Эталон: docs/moments/mockups/First-text.dc.html — книга влетает на
  // полку, маскот выглядывает и машет, новые слова в начале текста
  // подсвечиваются по очереди.
  return (
    <div className="onb-screen relative mx-auto flex min-h-screen w-full max-w-md flex-col pb-10">
      <div className="ft-thud" style={{ position: "relative", height: 280, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 26 }}>
        <div style={{ position: "absolute", left: "50%", top: 150, width: 0, height: 0 }}>
          <Confetti seed={23} count={22} fall={0} delay={0.9} />
        </div>
        <div aria-hidden="true" style={{ position: "absolute", left: 36, right: 36, bottom: 26, height: 16, borderRadius: 8, background: "#d6c3a5", boxShadow: "inset 0 -5px 0 0 #b89f7a" }} />
        <div aria-hidden="true" style={{ position: "absolute", left: 70, bottom: 42, display: "flex", gap: 4, alignItems: "flex-end" }}>
          <span style={{ width: 18, height: 96, borderRadius: 4, background: "#d6cfc3" }} />
          <span style={{ width: 14, height: 80, borderRadius: 4, background: "#e3dccf" }} />
        </div>
        <div className="ft-peek" style={{ position: "absolute", right: 44, bottom: 42 }} aria-hidden="true">
          <div className="ft-wave">
            <svg viewBox="0 0 128 150" width="72" height="84">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
              <ellipse cx="54" cy="62" rx="3.2" ry="4.4" fill="var(--leaf-edge)" />
              <ellipse cx="66" cy="62" rx="3.2" ry="4.4" fill="var(--leaf-edge)" />
              <path d="M53 71q7 7 14 0" fill="none" stroke="var(--leaf-edge)" strokeWidth="2.4" strokeLinecap="round" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            </svg>
          </div>
        </div>
        <div
          className="ft-fly"
          style={{ position: "relative", width: 132, height: 178, borderRadius: "8px 18px 18px 8px", background: "#0b79b0", boxShadow: "inset 8px 0 0 0 #075a85, inset 0 -6px 0 0 rgba(0,0,0,.2)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px 14px 16px 22px", color: "#fff", marginBottom: 16, textAlign: "left" }}
        >
          <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
            <path d="M20 4 L26 36 H14 Z" fill="#fff" opacity=".9" />
            <circle cx="20" cy="8" r="5" fill="var(--sun)" />
          </svg>
          <div className="mo-disp" style={{ fontSize: titleSize, fontWeight: 900, lineHeight: 1.15, textTransform: "uppercase", overflowWrap: "break-word" }}>
            {title}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 28px" }}>
        <h1 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 25, lineHeight: 1.2, fontWeight: 900, animationDelay: ".8s" }}>
          Первый текст на полке!
        </h1>
        <p className="mo-muted mo-rise" style={{ margin: "8px 0 0", fontSize: 15, animationDelay: ".9s" }}>
          Мы уже отметили, какие слова будут новыми
        </p>
      </div>

      <div className="ft-page mo-rise" style={{ margin: "18px 20px 0", animationDelay: "1.05s" }}>
        {excerpt.length > 0 ? (
          <p className="ft-txt" style={{ margin: 0 }}>
            {excerpt.map((t, i) =>
              t.isNew ? (
                <span key={i} className="ft-new ft-w" style={{ ["--d" as string]: `${(1.5 + markIndex++ * 0.2).toFixed(1)}s` } as CSSProperties}>
                  {t.text}
                </span>
              ) : (
                <span key={i}>{t.text}</span>
              ),
            )}
          </p>
        ) : (
          <p className="ft-txt" style={{ margin: 0 }}>{title}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Знакомо</span>
          <div className="ft-meter">
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: "var(--leaf)" }} />
          </div>
          <span className="mo-disp" style={{ fontSize: 15, fontWeight: 900, color: "var(--leaf-text)", minWidth: 42, textAlign: "right" }}>
            {pct}%
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          <span className="ft-chip" style={{ background: "var(--sun-tint)", color: "var(--sun-text)" }}>
            {familiarity.newWordCount} {wordsWord(familiarity.newWordCount, "новое слово", "новых слова", "новых слов")}
          </span>
          {familiarity.knownWordCount > 0 && (
            <span className="ft-chip" style={{ background: "var(--sky-tint)", color: "var(--sky-text-strong)" }}>
              {familiarity.knownWordCount} уже знаешь
            </span>
          )}
          {(levelTag || wordCount) && (
            <span className="ft-chip" style={{ background: "var(--surface-muted)" }}>
              {[wordCount ? `${wordCount} слов` : null, levelTag].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>

      <div className="mo-rise mt-auto px-5 pt-6" style={{ animationDelay: "1.2s" }}>
        <Link href={`/read/${textId}`} className="btn btn-leaf btn-md mo-cta">
          Открыть главу 1
        </Link>
      </div>
    </div>
  );
}

function wordsWord(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return few;
  return many;
}
