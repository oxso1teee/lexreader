import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";

const FLAGS: Record<string, string> = {
  en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹",
  ru: "🇷🇺", zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", tr: "🇹🇷", pl: "🇵🇱",
  nl: "🇳🇱", sv: "🇸🇪", ar: "🇸🇦",
};

// Раздел 5 промта 2026-07-30 (композиция): AccountSummaryCard + LanguageBanner
// сливаются в одну компактную строку — вместо двух отдельных карточек
// равного веса с той же самой сутью ("кто я, на каком языке").
export default function AccountStrip({
  plan,
  wordCount,
  textCount,
  targetLanguage,
}: {
  plan: "free" | "premium_monthly" | "premium_yearly";
  wordCount: number;
  textCount: number;
  targetLanguage: string;
}) {
  const name = LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? targetLanguage;
  const flag = FLAGS[targetLanguage] ?? "🌐";

  return (
    <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-bold">LexReader</span>
        {plan !== "free" && (
          <span className="rounded-full bg-caramel px-2 py-0.5 text-xs font-semibold text-white">
            Premium
          </span>
        )}
        <span className="truncate text-xs text-black/40 dark:text-white/40">
          {wordCount} слов · {textCount} текстов
        </span>
      </div>
      <Link
        href="/settings"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/15 px-2.5 py-1 text-xs font-medium dark:border-white/20"
      >
        {flag} {name}
      </Link>
    </div>
  );
}
