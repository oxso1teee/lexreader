import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasFreeTextRoom } from "../actions";
import AddTextTabs from "./add-text-tabs";

// P0-АУДИТ (раздел 4): импорт по URL/YouTube делает до двух последовательных
// внешних запросов по 10 сек каждый — без явного maxDuration был риск
// упереться в лимит выполнения функции на Vercel раньше, чем сработает наш
// собственный AbortSignal.timeout, и получить generic 504 вместо понятной
// ошибки.
export const maxDuration = 30;

export default async function NewTextPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const canAddText = await hasFreeTextRoom(supabase, profile.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <div className="flex items-center gap-3 px-5 pt-6">
        <Link href="/library" className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
          ← Библиотека
        </Link>
      </div>
      <h1 className="px-5 pt-2 text-xl font-semibold">Добавить текст</h1>
      <AddTextTabs targetLanguage={profile.target_language} canAddText={canAddText} />
    </div>
  );
}
