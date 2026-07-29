import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AddCardForm from "./add-card-form";
import CardRow from "./card-row";
import EmptyState from "@/components/empty-state";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("decks")
    .select("id, name, is_default")
    .eq("id", deckId)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!deck) notFound();

  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, front, back, notes")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <Link href="/brain" className="text-sm text-caramel">
        ← Мозг
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{deck.name}</h1>
        <Link
          href={`/brain/${deckId}/review`}
          className="rounded-full bg-caramel px-4 py-2 text-sm font-medium text-white"
        >
          Начать повторение
        </Link>
      </div>

      <AddCardForm
        deckId={deckId}
        targetLanguage={profile.target_language}
        nativeLanguage={profile.native_language}
      />

      {!cards || cards.length === 0 ? (
        <EmptyState
          icon="🧠✨"
          title="В колоде пока нет карточек"
          body="Добавь вручную выше или через «Импорт» на экране «Мозг»."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((c) => (
            <CardRow
              key={c.id}
              deckId={deckId}
              id={c.id}
              front={c.front}
              back={c.back}
              notes={c.notes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
