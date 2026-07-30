import Link from "next/link";
import ProgressRing from "@/components/progress-ring";
import { LANGUAGES } from "@/lib/languages";
import StreakPill from "./streak-pill";

const FLAGS: Record<string, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  pt: "🇵🇹",
  ru: "🇷🇺",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
  tr: "🇹🇷",
  pl: "🇵🇱",
  nl: "🇳🇱",
  sv: "🇸🇪",
  ar: "🇸🇦",
};

// docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, раздел 4.2: заменяет
// восемь независимых карточек (account-summary/language-banner/premium/
// welcome/daily-goal-ring/stat-row) одной карточкой "сегодня". Приветствие
// для новых пользователей (раньше — отдельный welcome-card.tsx) — просто
// другой текст в той же карточке, не отдельный визуальный блок.
function isNewAccount(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() <= 7 * 86_400_000;
}

export default function TodayCard({
  createdAt,
  targetLanguage,
  wordCount,
  textCount,
  dueCount,
  newWordsToday,
  dailyGoal,
  streak,
}: {
  createdAt: string;
  targetLanguage: string;
  wordCount: number;
  textCount: number;
  dueCount: number;
  newWordsToday: number;
  dailyGoal: number;
  streak: number;
}) {
  const langName = LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? targetLanguage;
  const flag = FLAGS[targetLanguage] ?? "🌐";
  const greeting = isNewAccount(createdAt) ? "Добро пожаловать" : "С возвращением";
  const ratio = dailyGoal > 0 ? newWordsToday / dailyGoal : 0;
  const goalReached = dailyGoal > 0 && newWordsToday >= dailyGoal;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-strong">
          {langName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-black/40 dark:text-white/40">{greeting}</p>
          <p className="truncate text-sm font-bold">{langName}</p>
        </div>
        <StreakPill streak={streak} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-black/60 dark:text-white/60">
        <span>{flag}</span> Учишь {langName.toLowerCase()} ·{" "}
        <Link href="/settings" className="underline underline-offset-2">
          сменить
        </Link>
      </p>

      <hr className="my-3 border-black/10 dark:border-white/10" />

      <div className="flex items-center gap-4">
        <div className="relative">
          <ProgressRing ratio={ratio} />
          {goalReached && (
            <span className="goal-check-in absolute inset-0 flex items-center justify-center">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                  <path d="M5 13l4 4 10-10" />
                </svg>
              </span>
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums">
            {newWordsToday} / {dailyGoal} слов
          </p>
          <p className="text-xs text-black/40 dark:text-white/40">дневная цель</p>
        </div>
      </div>

      <hr className="my-3 border-black/10 dark:border-white/10" />

      <div className="flex">
        {[
          { n: wordCount, l: "слов" },
          { n: textCount, l: "текстов" },
          { n: dueCount, l: "к повтору" },
        ].map((s, i) => (
          <div
            key={s.l}
            className={`flex-1 px-1 text-center ${i > 0 ? "border-l border-black/10 dark:border-white/10" : ""}`}
          >
            <p className="font-mono text-lg font-bold tabular-nums">{s.n}</p>
            <p className="text-[10px] uppercase tracking-wide text-black/40 dark:text-white/40">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
