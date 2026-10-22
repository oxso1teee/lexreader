"use client";

import Link from "next/link";
import { Confetti } from "@/components/product/moments/confetti";
import { useCountUp } from "@/components/product/moments/use-count-up";
import type { TextFamiliarity } from "@/lib/vocabulary/text-familiarity";

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
}: {
  textId: string;
  title: string;
  levelTag: string | null;
  wordCount: number | null;
  familiarity: TextFamiliarity;
}) {
  const pct = useCountUp(familiarity.percentFamiliar, { delay: 300, duration: 900 });

  return (
    <div className="onb-screen relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-10 text-center">
      <div className="relative flex h-[220px] items-end justify-center pb-5">
        <div className="relative h-0 w-0">
          <Confetti seed={23} count={22} fall={0} />
        </div>
        <div
          className="mo-pop relative flex w-[150px] flex-col justify-between rounded-[8px_18px_18px_8px] px-4 py-4 text-left text-white"
          style={{ background: "var(--sky)", boxShadow: "inset 8px 0 0 0 var(--sky-edge), inset 0 -6px 0 0 rgba(0,0,0,.2)" }}
        >
          <svg viewBox="0 0 40 40" width={28} height={28} aria-hidden="true">
            <path d="M20 4 L26 36 H14 Z" fill="#fff" opacity=".9" />
            <circle cx="20" cy="8" r="5" fill="var(--sun)" />
          </svg>
          <div className="font-black uppercase leading-tight" style={{ fontFamily: "var(--font-reading, Georgia, serif)", fontSize: 13 }}>
            {title}
          </div>
        </div>
      </div>

      <h1 className="mo-rise text-[23px] font-black leading-tight" style={{ animationDelay: "0.3s" }}>
        Первый текст на полке!
      </h1>
      <p className="mo-rise mt-2 text-sm text-[var(--text-secondary)]" style={{ animationDelay: "0.35s" }}>
        Мы уже отметили, какие слова будут новыми
      </p>

      <div className="mo-rise mt-4 rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] p-4 text-left" style={{ animationDelay: "0.4s" }}>
        <p className="text-base leading-relaxed" style={{ fontFamily: "var(--font-reading, Georgia, serif)" }}>
          {title}
        </p>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="text-sm font-bold">Знакомо</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--leaf)" }} />
          </div>
          <span className="min-w-[42px] text-right text-[15px] font-black" style={{ color: "var(--leaf-text)" }}>
            {pct}%
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-lg px-2.5 py-1.5 text-[13px] font-bold" style={{ background: "var(--sun-tint)", color: "var(--sun-text)" }}>
            {familiarity.newWordCount} новых слов
          </span>
          <span className="rounded-lg px-2.5 py-1.5 text-[13px] font-bold" style={{ background: "var(--sky-tint)", color: "var(--sky-text-strong)" }}>
            {familiarity.knownWordCount} уже знаешь
          </span>
          {levelTag && (
            <span className="rounded-lg px-2.5 py-1.5 text-[13px] font-bold" style={{ background: "var(--surface-muted)" }}>
              {wordCount ? `${wordCount} слов · ${levelTag}` : levelTag}
            </span>
          )}
        </div>
      </div>

      <div className="mo-rise mt-auto pt-6" style={{ animationDelay: "0.5s" }}>
        <Link
          href={`/read/${textId}`}
          className="focus-ring flex min-h-[54px] w-full items-center justify-center rounded-2xl px-5 font-bold text-white"
          style={{ background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }}
        >
          Открыть главу 1
        </Link>
      </div>
    </div>
  );
}
