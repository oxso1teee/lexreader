import Link from "next/link";
import { Headphones, Keyboard, Layers, ListChecks, Puzzle, type LucideIcon } from "lucide-react";

// Practice Home "quick practice" (Slice 4 §5): only real, working modes.
// Choice/Type/Match are binary-graded (not the full 4-rating FSRS/SM-2
// flow) — labeled honestly via each tile's own subtitle now, not a shared
// disclaimer paragraph. Listening isn't wired to a mode yet (no per-card
// audio-first flow exists) — shown disabled ("план"), not as a dead button
// that looks active.
//
// Practice hub mockup alignment — reference is a 5-tile "practice hub"
// (Words/Fill-the-gap/Listen/Match/wide Read-to-Library), but that's not a
// 1:1 copy: no reading/video/library tile here (they already have their own
// section + nav tab), and "Fill the gap" is a real, already-built mode
// (context-gap-mode.tsx) that just isn't wired to /brain/all/review?mode=
// yet — wiring it up is functional work, out of this purely-visual task's
// scope. This restyles the SAME 5 existing elements (4 working modes + the
// honestly-disabled "На слух") to the reference's tile look, nothing added
// or removed.
const MODES: { mode: string; icon: LucideIcon; label: string; subtitle: string }[] = [
  { mode: "cards", icon: Layers, label: "Карточки", subtitle: "" }, // filled in per-render, see dueCount below
  { mode: "choice", icon: ListChecks, label: "Выбор ответа", subtitle: "Верно / неверно" },
  { mode: "type", icon: Keyboard, label: "Напечатать", subtitle: "Верно / неверно" },
  { mode: "match", icon: Puzzle, label: "Пары", subtitle: "Верно / неверно" },
];

export default function QuickPracticeGrid({ dueCount }: { dueCount: number }) {
  return (
    <div>
      <h2 className="mb-2 font-semibold">Быстрая практика</h2>
      <div className="grid grid-cols-2 gap-[9px]">
        {MODES.map((m) => {
          // Cards' own honest subtitle: the real due count (not the
          // Choice/Type/Match "Верно/неверно" reformulation — Cards is
          // graded on the real 4-point FSRS/SM-2 scale, not binary, which
          // is exactly why it needs a different, real fact here rather
          // than reusing theirs). "0" alone would read as a broken counter,
          // not "nothing to do" — a neutral label there instead, same
          // subtitle slot every tile gets, no empty gap in the layout.
          const subtitle = m.mode === "cards" ? (dueCount > 0 ? `К повторению: ${dueCount}` : "Нечего повторять") : m.subtitle;
          return (
            <Link
              key={m.mode}
              href={`/brain/all/review?mode=${m.mode}`}
              className="focus-ring flex flex-col rounded-[16px] border border-[var(--border)] bg-card px-[14px] py-[13px] transition-colors hover:bg-[var(--surface-muted)]"
            >
              <span className="mb-[18px] flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[var(--color-forest-tint)]">
                {/* color: var(--forest) in the reference measures ~1.6-1.7:1
                    against --card in dark theme (same bug PR #81 fixed
                    elsewhere) -- --color-forest-text is the theme-aware
                    token tokens.css already defines for exactly this. */}
                <m.icon aria-hidden="true" className="h-[15px] w-[15px] text-[var(--color-forest-text)]" />
              </span>
              <span className="text-[12.5px] font-bold">{m.label}</span>
              <span className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{subtitle}</span>
            </Link>
          );
        })}
        {/* Reference-suggested layout for an odd 5th tile on a 2-col grid —
            stretched full-width instead of hanging as a lone half-width
            tile. Stays a plain div (not a Link) -- there's nowhere real for
            it to navigate to yet. */}
        <div className="col-span-2 flex flex-col rounded-[16px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-[14px] py-[13px] text-[var(--text-secondary)]">
          <span className="mb-[18px] flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-black/5 dark:bg-white/10">
            <Headphones aria-hidden="true" className="h-[15px] w-[15px]" />
          </span>
          <span className="text-[12.5px] font-bold">На слух</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide">план</span>
        </div>
      </div>
    </div>
  );
}
