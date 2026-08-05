import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasFreeTextRoom, getCollections } from "../actions";
import AddTextTabs from "./add-text-tabs";

// P0-АУДИТ (раздел 4): импорт по URL/YouTube делает до двух последовательных
// внешних запросов по 10 сек каждый — без явного maxDuration был риск
// упереться в лимит выполнения функции на Vercel раньше, чем сработает наш
// собственный AbortSignal.timeout, и получить generic 504 вместо понятной
// ошибки. Поднято до 45: запрос страницы видео YouTube через ScraperAPI
// (см. youtube-actions.ts) сам по себе может занимать до 20 сек.
export const maxDuration = 45;

export default async function NewTextPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [canAddText, collections] = await Promise.all([
    hasFreeTextRoom(supabase, profile.id),
    getCollections(supabase, profile.id, profile.target_language),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <div className="flex items-center gap-3 px-5 pt-6">
        <Link href="/library" className="focus-ring text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--color-forest-text)]">
          ← Библиотека
        </Link>
      </div>
      <h1 className="text-h1 px-5 pt-2">Добавить материал</h1>
      <AddTextTabs
        targetLanguage={profile.target_language}
        canAddText={canAddText}
        collections={collections}
      />
    </div>
  );
}
