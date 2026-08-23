import Link from "next/link";
import { Headphones, Keyboard, Layers, ListChecks, Puzzle, type LucideIcon } from "lucide-react";

// Practice Home "quick practice" (Slice 4 §5): only real, working modes.
// Choice/Type/Match are binary-graded (not the full 4-rating FSRS/SM-2
// flow) — labeled honestly via the shared caption, not presented as
// equivalent to Cards. Listening isn't wired to a mode yet (no per-card
// audio-first flow exists) — shown disabled ("план"), not as a dead button
// that looks active.
//
// Раздел B.3 файла 10: иконки режимов практики функциональные (кнопки
// действий) — раньше были эмодзи-строкой, теперь lucide.
const MODES: { mode: string; icon: LucideIcon; label: string }[] = [
  { mode: "cards", icon: Layers, label: "Карточки" },
  { mode: "choice", icon: ListChecks, label: "Выбор ответа" },
  { mode: "type", icon: Keyboard, label: "Напечатать" },
  { mode: "match", icon: Puzzle, label: "Пары" },
];

export default function QuickPracticeGrid() {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">Быстрая практика</h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        Выбор/Напечатать/Пары оценивают ответ как верно/неверно — это не полная 4-балльная
        оценка, как в Карточках
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((m) => (
          <Link
            key={m.mode}
            href={`/brain/all/review?mode=${m.mode}`}
            className="flex flex-col items-center gap-1 rounded-xl border border-black/10 px-3 py-3 text-center text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            <m.icon aria-hidden="true" className="h-5 w-5" />
            <span>{m.label}</span>
          </Link>
        ))}
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-black/15 px-3 py-3 text-center text-sm font-medium text-[var(--text-secondary)] dark:border-white/20">
          <Headphones aria-hidden="true" className="h-5 w-5" />
          <span>На слух</span>
          <span className="text-[10px] uppercase tracking-wide">план</span>
        </div>
      </div>
    </div>
  );
}
