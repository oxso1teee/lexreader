import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DeckList from "./deck-list";
import NewDeckModal from "./new-deck-modal";
import ImportModal from "./import-modal";
import StarterDeckCard from "./starter-deck-card";
import { STARTER_DECKS } from "@/lib/starter-decks";
import { getDueCount } from "@/lib/brain-stats";

// Перевод слов стартовых колод (lib/starter-decks.ts) считается на лету
// через MyMemory при нажатии "+ Добавить" — партиями, но всё равно сетевой
// round-trip на ~60 слов, отсюда тот же запас времени, что и у импорта по
// URL/YouTube в library/new/page.tsx.
export const maxDuration = 45;

export default async function BrainPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Найдено при повторном аудите: у decks/flashcards не было колонки language
  // — при смене изучаемого языка Мозг показывал колоды и карточки всех
  // языков вперемешку. Теперь список и счётчик "к повторению" ограничены
  // текущим target_language, как и остальные части приложения.
  const [{ data: decks }, { data: flashcards }, dueCount] = await Promise.all([
    supabase
      .from("decks")
      .select("id, name, is_default, is_starter")
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("flashcards")
      .select("id, deck_id")
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language),
    getDueCount(supabase, profile.id, profile.target_language),
  ]);

  const countByDeck = new Map<string, number>();
  for (const f of flashcards ?? []) {
    countByDeck.set(f.deck_id, (countByDeck.get(f.deck_id) ?? 0) + 1);
  }

  const deckOptions = (decks ?? []).map((d) => ({ id: d.id, name: d.name }));
  const addedStarterTitles = new Set(
    (decks ?? []).filter((d) => d.is_starter).map((d) => d.name),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <div>
        <h1 className="text-2xl font-bold">🧠 Мозг</h1>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm text-black/50 dark:text-white/50">{profile.target_language}</p>
          <span className="rounded-lg border border-black/20 px-2.5 py-1 text-sm font-medium dark:border-white/25">
            {flashcards?.length ?? 0} слов
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-5 text-center shadow-sm">
        {dueCount && dueCount > 0 ? (
          <>
            <p className="mb-3 font-medium">Карточек к повторению: {dueCount}</p>
            <Link
              href="/brain/all/review"
              className="inline-block rounded-full bg-caramel px-5 py-2.5 font-medium text-white"
            >
              Начать повторение
            </Link>
          </>
        ) : (
          <p>🎉 Всё повторено!</p>
        )}
      </div>

      <div className="flex gap-2">
        <NewDeckModal />
        <ImportModal decks={deckOptions} targetLanguage={profile.target_language} />
        <Link
          href="/brain/settings"
          className="rounded-full border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25"
        >
          ⚙️ Настройки
        </Link>
      </div>

      {profile.target_language === "en" && (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-1 font-semibold">Стартовые колоды</h2>
          <p className="mb-3 text-xs text-black/40 dark:text-white/40">
            Готовые наборы частых слов по уровням — не расходуют лимит бесплатного тарифа
          </p>
          <div className="flex flex-col gap-2">
            {Object.values(STARTER_DECKS).map((def) => (
              <StarterDeckCard
                key={def.level}
                def={def}
                alreadyAdded={addedStarterTitles.has(def.title)}
              />
            ))}
          </div>
        </div>
      )}

      <DeckList
        decks={(decks ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          isDefault: d.is_default,
          cardCount: countByDeck.get(d.id) ?? 0,
        }))}
      />
    </div>
  );
}
