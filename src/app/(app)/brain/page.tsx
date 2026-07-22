import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DeckCard from "./deck-card";
import NewDeckModal from "./new-deck-modal";
import ImportModal from "./import-modal";

export default async function BrainPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: decks }, { data: flashcards }, { count: dueCount }] = await Promise.all([
    supabase
      .from("decks")
      .select("id, name, is_default")
      .eq("owner_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase.from("flashcards").select("id, deck_id").eq("owner_id", profile.id),
    supabase
      .from("srs_state")
      .select("flashcard_id, flashcards!inner(owner_id)", { count: "exact", head: true })
      .eq("flashcards.owner_id", profile.id)
      .lte("due_at", new Date().toISOString()),
  ]);

  const countByDeck = new Map<string, number>();
  for (const f of flashcards ?? []) {
    countByDeck.set(f.deck_id, (countByDeck.get(f.deck_id) ?? 0) + 1);
  }

  const deckOptions = (decks ?? []).map((d) => ({ id: d.id, name: d.name }));

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
        <ImportModal decks={deckOptions} />
        <Link
          href="/brain/settings"
          className="rounded-full border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25"
        >
          ⚙️ Настройки
        </Link>
      </div>

      <input
        type="text"
        placeholder="Поиск колод..."
        className="w-full rounded-lg border border-black/15 bg-card px-4 py-2.5 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
      />

      <div className="flex flex-col gap-2">
        {(decks ?? []).map((d) => (
          <DeckCard
            key={d.id}
            id={d.id}
            name={d.name}
            isDefault={d.is_default}
            cardCount={countByDeck.get(d.id) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
