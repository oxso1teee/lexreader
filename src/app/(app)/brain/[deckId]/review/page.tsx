import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getSrsSettings } from "@/lib/srs-settings";
import type { SrsParams } from "@/lib/srs";
import type { ReviewCard } from "./review-session";
import ReviewModeSwitcher from "./review-mode-switcher";

const SELECT =
  "flashcard_id, due_at, repetitions, ease_factor, interval_days, flashcards!inner(id, front, back, notes, deck_id, owner_id)";

interface SrsStateRow {
  flashcard_id: string;
  due_at: string;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  flashcards:
    | { front: string; back: string; notes: string | null; deck_id: string }
    | { front: string; back: string; notes: string | null; deck_id: string }[];
}

function toCards(rows: SrsStateRow[] | null): ReviewCard[] {
  return (rows ?? []).map((row) => {
    const card = row.flashcards as unknown as {
      front: string;
      back: string;
      notes: string | null;
      deck_id: string;
    };
    return {
      flashcardId: row.flashcard_id,
      deckId: card.deck_id,
      front: card.front,
      back: card.back,
      notes: card.notes,
      easeFactor: row.ease_factor,
      intervalDays: row.interval_days,
      repetitions: row.repetitions,
    };
  });
}

export default async function DeckReviewPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getSrsSettings(supabase, profile.id);
  const now = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // P0-АУДИТ 3.11: раньше new_cards_per_day ограничивал очередь только в
  // рамках одного открытия этой страницы — повторное открытие снова выдавало
  // полную порцию. Вычитаем уже показанные сегодня новые карточки.
  const { count: alreadyIntroducedToday } = await supabase
    .from("srs_state")
    .select("flashcard_id, flashcards!inner(owner_id, language)", { count: "exact", head: true })
    .eq("flashcards.owner_id", profile.id)
    .eq("flashcards.language", profile.target_language)
    .gte("first_reviewed_at", todayStart.toISOString());
  const remainingNewCards = Math.max(0, settings.new_cards_per_day - (alreadyIntroducedToday ?? 0));

  // P0-АУДИТ 3.11 (испр.): раньше границу "новая / на повторение" проводили
  // по repetitions (0 = новая) — но лапнувшая (забытая) карточка тоже имеет
  // repetitions=0, из-за чего она конкурировала с настоящими новыми
  // карточками за дневной лимит remainingNewCards вместо того, чтобы просто
  // считаться повторением. Граница теперь по first_reviewed_at: "новая" —
  // только та, что вообще ни разу не была показана.
  // Найдено при повторном аудите: у flashcards не было колонки language —
  // очередь повторения "все колоды" (deckId === "all") подмешивала карточки
  // всех изучаемых языков сразу. Теперь очередь всегда ограничена текущим
  // target_language.
  let reviewQuery = supabase
    .from("srs_state")
    .select(SELECT)
    .eq("flashcards.owner_id", profile.id)
    .eq("flashcards.language", profile.target_language)
    .not("first_reviewed_at", "is", null)
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(settings.max_reviews_per_day);

  let newQuery = supabase
    .from("srs_state")
    .select(SELECT)
    .eq("flashcards.owner_id", profile.id)
    .eq("flashcards.language", profile.target_language)
    .is("first_reviewed_at", null)
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(remainingNewCards);

  if (deckId !== "all") {
    reviewQuery = reviewQuery.eq("flashcards.deck_id", deckId);
    newQuery = newQuery.eq("flashcards.deck_id", deckId);
  }

  const [{ data: reviewRows }, { data: newRows }] = await Promise.all([reviewQuery, newQuery]);

  // Сначала карточки на повторение (не дать очереди повторов утонуть в новых
  // карточках), затем новые — раздел 6.2 роадмапа: два независимых лимита.
  const cards: ReviewCard[] = [...toCards(reviewRows), ...toCards(newRows)];

  const srsParams: SrsParams = {
    easyBonus: settings.easy_bonus,
    intervalModifier: settings.interval_modifier,
    maxIntervalDays: settings.max_interval_days,
    graduatingIntervalDays: settings.graduating_interval_days,
    easyIntervalDays: settings.easy_interval_days,
  };

  return (
    <ReviewModeSwitcher cards={cards} studyDirection={settings.study_direction} srsParams={srsParams} />
  );
}
