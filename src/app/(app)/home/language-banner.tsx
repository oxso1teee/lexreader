import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";

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

export default function LanguageBanner({ targetLanguage }: { targetLanguage: string }) {
  const name = LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? targetLanguage;
  const flag = FLAGS[targetLanguage] ?? "🌐";

  return (
    <Link
      href="/settings"
      className="block rounded-2xl bg-caramel p-4 text-center text-white shadow-sm"
    >
      <p className="text-sm">👇 Нажмите сюда, чтобы</p>
      <p className="mt-0.5 text-lg font-bold">
        изучать {flag} {name}
      </p>
    </Link>
  );
}
