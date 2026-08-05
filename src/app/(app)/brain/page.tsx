import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DeckList from "./deck-list";
import NewDeckModal from "./new-deck-modal";
import ImportModal from "./import-modal";
import StarterDeckCard from "./starter-deck-card";
import { STARTER_DECKS } from "@/lib/starter-decks";
import {
  getDueCount,
  getAvailableNewCount,
  getNewCardsRemainingToday,
  getReviewsTodayCount,
  getHardestWords,
  estimateReviewMinutes,
} from "@/lib/brain-stats";
import { getSrsSettings } from "@/lib/srs-settings";
import { getPlan, FREE_DECK_LIMIT } from "@/lib/subscription";
import { greetingForHour } from "@/lib/today";
import PageHeader from "@/components/product/page-header";
import PracticeHero from "./practice-hero";
import DailyProgressCard from "./daily-progress-card";
import WeakWordsCard from "./weak-words-card";
import QuickPracticeGrid from "./quick-practice-grid";

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
  const [
    { data: decks },
    { data: flashcards },
    dueCount,
    availableNewCount,
    reviewedToday,
    weakWords,
    srsSettings,
    { count: readingWordCount },
    plan,
    { count: nonStarterDeckCount },
  ] = await Promise.all([
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
    getAvailableNewCount(supabase, profile.id, profile.target_language),
    getReviewsTodayCount(supabase, profile.id, profile.target_language),
    getHardestWords(supabase, profile.id, profile.target_language, 3),
    getSrsSettings(supabase, profile.id),
    // Тетрадь и Мозг раньше ощущались как два разных раздела — слились в
    // один: слова из чтения видны здесь же и попадают в реальное повторение
    // (см. supabase/migrations/0028_link_reading_words_to_brain.sql).
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language),
    getPlan(supabase, profile.id),
    // M3 Slice 4 §12: тот же счётчик, что и hasFreeDeckRoom (src/lib/
    // subscription.ts) — БЕЗ фильтра по языку (лимит колод общий на все
    // изучаемые языки), иначе превью лимита разошлось бы с реальной
    // серверной проверкой в createDeck.
    supabase
      .from("decks")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("is_starter", false),
  ]);

  const countByDeck = new Map<string, number>();
  for (const f of flashcards ?? []) {
    countByDeck.set(f.deck_id, (countByDeck.get(f.deck_id) ?? 0) + 1);
  }

  const deckOptions = (decks ?? []).map((d) => ({ id: d.id, name: d.name }));
  const addedStarterTitles = new Set(
    (decks ?? []).filter((d) => d.is_starter).map((d) => d.name),
  );

  // Тот же лимит "новых карточек в день", что и сама очередь повторения
  // (review/page.tsx) — иначе главный экран пообещал бы больше новых
  // карточек, чем реально появится в сессии.
  const remainingNewBudget = await getNewCardsRemainingToday(
    supabase,
    profile.id,
    profile.target_language,
    srsSettings.new_cards_per_day,
  );
  const newCount = Math.min(availableNewCount, remainingNewBudget);
  const dailyTarget = dueCount + newCount;
  const greeting = greetingForHour(new Date().getHours());
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader
        title={`${greeting}!`}
        description={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        action={
          profile.streak_current > 0 ? (
            <span className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium dark:border-white/15">
              🔥 Стрик {profile.streak_current}
            </span>
          ) : undefined
        }
      />

      <PracticeHero
        userId={profile.id}
        dueCount={dueCount}
        newCount={newCount}
        estMinutes={estimateReviewMinutes(dailyTarget)}
      />

      <DailyProgressCard reviewedToday={reviewedToday} target={dailyTarget} />

      <WeakWordsCard words={weakWords} />

      <QuickPracticeGrid />

      {readingWordCount ? (
        <Link
          href="/notebook"
          className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 text-sm shadow-sm"
        >
          <span>📖 Слова из чтения · {readingWordCount}</span>
          <span>›</span>
        </Link>
      ) : null}

      <div className="flex gap-2">
        <NewDeckModal
          deckCount={nonStarterDeckCount ?? 0}
          atLimit={plan === "free" && (nonStarterDeckCount ?? 0) >= FREE_DECK_LIMIT}
        />
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
