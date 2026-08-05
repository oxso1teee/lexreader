import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getVocabularyRows } from "@/lib/vocabulary-list";
import { getPlan, FREE_DECK_LIMIT } from "@/lib/subscription";
import PageHeader from "@/components/product/page-header";
import VocabularyBrowser from "./vocabulary-browser";

export default async function VocabularyPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [rows, { data: decks }, plan, { count: nonStarterDeckCount }] = await Promise.all([
    getVocabularyRows(supabase, profile.id, profile.target_language),
    supabase
      .from("decks")
      .select("id, name, is_default, is_starter")
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    getPlan(supabase, profile.id),
    supabase
      .from("decks")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("is_starter", false),
  ]);

  // M3 Slice 4 §9: due/new/known на колоду нигде не считались (подтверждено
  // аудитом) — агрегируем из того же единого списка rows, а не отдельным
  // запросом на группировку.
  const deckSummaries = (decks ?? []).map((d) => {
    const cardsInDeck = rows.filter((r) => r.deckId === d.id);
    return {
      id: d.id,
      name: d.name,
      isDefault: d.is_default,
      isStarter: d.is_starter,
      cardCount: cardsInDeck.length,
      dueCount: cardsInDeck.filter((r) => r.schedulerBucket === "due").length,
      newCount: cardsInDeck.filter((r) => r.schedulerBucket === "new").length,
      knownCount: cardsInDeck.filter((r) => r.schedulerBucket === "known").length,
    };
  });

  const addedStarterTitles = (decks ?? []).filter((d) => d.is_starter).map((d) => d.name);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Словарь" description="Слова, фразы и колоды" />
      <VocabularyBrowser
        rows={rows}
        decks={deckSummaries}
        targetLanguage={profile.target_language}
        newDeckCount={nonStarterDeckCount ?? 0}
        newDeckAtLimit={plan === "free" && (nonStarterDeckCount ?? 0) >= FREE_DECK_LIMIT}
        showStarterDecks={profile.target_language === "en"}
        addedStarterTitles={addedStarterTitles}
      />
    </div>
  );
}
