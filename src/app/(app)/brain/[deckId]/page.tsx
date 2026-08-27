import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AddCardForm from "./add-card-form";
import CardRow from "./card-row";
import DeckTitle from "./deck-title";
import DeleteDeckButton from "./delete-deck-button";
import DeckAnalytics from "./deck-analytics";
import EmptyState from "@/components/empty-state";

export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { deckId } = await params;
  const { created } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("decks")
    .select("id, name, is_default, is_starter")
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
      <DeckAnalytics
        deckType={deck.is_default ? "default" : deck.is_starter ? "starter" : "custom"}
        cardCount={cards?.length ?? 0}
        justCreated={created === "true"}
      />
      <Link href="/brain/vocabulary" className="text-sm text-[var(--color-forest-text)]">
        ← Словарь и колоды
      </Link>

      <div className="flex items-center justify-between gap-2">
        <DeckTitle deckId={deckId} name={deck.name} isDefault={deck.is_default} isStarter={deck.is_starter} />
        <Link
          href={`/brain/${deckId}/review`}
          className="shrink-0 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
        >
          Начать повторение
        </Link>
      </div>

      {(deck.is_default || deck.is_starter) && (
        <p className="text-xs text-[var(--text-secondary)]">
          {deck.is_default
            ? "Главную колоду нельзя удалить — слова из чтения сохраняются в неё автоматически."
            : "Стартовую колоду нельзя удалить — это общий бесплатный набор, не расходующий лимит тарифа."}
        </p>
      )}

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

      {!deck.is_default && !deck.is_starter && (
        <DeleteDeckButton deckId={deckId} name={deck.name} cardCount={cards?.length ?? 0} />
      )}
    </div>
  );
}
