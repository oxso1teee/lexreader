import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getSrsSettings } from "@/lib/srs-settings";
import { isMissingFsrsColumnsError } from "@/lib/fsrs";
import { getFsrsFlags } from "@/lib/fsrs-flags";
import type { SrsParams } from "@/lib/srs";
import type { ReviewCard } from "./review-session";
import ReviewModeSwitcher from "./review-mode-switcher";

// Отдельные строковые литералы (не конкатенация) — Supabase-js выводит форму
// строки из литерального типа select(), конкатенация через `+` расширяет тип
// до `string` и ломает вывод типов.
//
// M3 Slice 4 §6: context_sentence/context_translation/source_text_id/
// photo_url уже существуют на flashcards с migration 0028 — сюда их просто
// не выбирали. texts(title) — embed по существующему FK
// flashcards.source_text_id -> texts.id, без новой схемы.
const CARD_FIELDS =
  "id, front, back, notes, deck_id, owner_id, context_sentence, context_translation, photo_url, source_text_id, texts(title)" as const;
const LEGACY_SELECT =
  `flashcard_id, due_at, repetitions, ease_factor, interval_days, last_reviewed_at, flashcards!inner(${CARD_FIELDS})` as const;
const FSRS_SELECT =
  `flashcard_id, due_at, repetitions, ease_factor, interval_days, last_reviewed_at, fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_lapses, fsrs_reps, fsrs_scheduled_days, flashcards!inner(${CARD_FIELDS})` as const;

interface CardRow {
  front: string;
  back: string;
  notes: string | null;
  deck_id: string;
  context_sentence: string | null;
  context_translation: string | null;
  photo_url: string | null;
  source_text_id: string | null;
  texts: { title: string } | { title: string }[] | null;
}

interface SrsStateRow {
  flashcard_id: string;
  due_at: string;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  last_reviewed_at: string | null;
  fsrs_stability?: number | null;
  fsrs_difficulty?: number | null;
  fsrs_state?: number | null;
  fsrs_lapses?: number;
  fsrs_reps?: number;
  fsrs_scheduled_days?: number;
  flashcards: CardRow | CardRow[];
}

function toCards(rows: SrsStateRow[] | null): ReviewCard[] {
  return (rows ?? []).map((row) => {
    const card = row.flashcards as unknown as CardRow;
    const text = Array.isArray(card.texts) ? card.texts[0] : card.texts;
    return {
      flashcardId: row.flashcard_id,
      deckId: card.deck_id,
      front: card.front,
      back: card.back,
      notes: card.notes,
      contextSentence: card.context_sentence,
      contextTranslation: card.context_translation,
      photoUrl: card.photo_url,
      sourceTextId: card.source_text_id,
      sourceTextTitle: text?.title ?? null,
      easeFactor: row.ease_factor,
      intervalDays: row.interval_days,
      repetitions: row.repetitions,
      fsrsState: {
        fsrsStability: row.fsrs_stability ?? null,
        fsrsDifficulty: row.fsrs_difficulty ?? null,
        fsrsState: row.fsrs_state ?? null,
        fsrsLapses: row.fsrs_lapses ?? 0,
        fsrsReps: row.fsrs_reps ?? 0,
        fsrsScheduledDays: row.fsrs_scheduled_days ?? 0,
        dueAt: row.due_at,
        lastReviewedAt: row.last_reviewed_at,
      },
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
  const flags = getFsrsFlags(profile.id);

  // Инцидент 2026-08-01 (FSRS Production Rollout Phase 1) + Schema
  // Compatibility Hotfix: код и migration 0032 могут быть задеплоены
  // раздельно — если fsrs_*-колонок ещё нет в БД, select с ними падает
  // целиком ("42703 undefined_column"), а не только по новым полям.
  // flags.shadowEnabled решает ДО отправки запроса, какой select
  // использовать; 42703-fallback ниже — только defense in depth на случай,
  // если флаг выставлен раньше реальной миграции. buildQueries пересобирает
  // тот же фильтр под любой select (два отдельных ЛИТЕРАЛЬНЫХ вызова, не
  // тернарник внутри одного — иначе Supabase-js не может распарсить select
  // в момент компиляции).
  function buildQueries<Select extends string>(select: Select) {
    let reviewQuery = supabase
      .from("srs_state")
      .select(select)
      .eq("flashcards.owner_id", profile.id)
      .eq("flashcards.language", profile.target_language)
      .not("first_reviewed_at", "is", null)
      .lte("due_at", now)
      .order("due_at", { ascending: true })
      .limit(settings.max_reviews_per_day);

    let newQuery = supabase
      .from("srs_state")
      .select(select)
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
    return { reviewQuery, newQuery };
  }

  // Два отдельных литеральных вызова buildQueries — не buildQueries(cond ?
  // FSRS_SELECT : LEGACY_SELECT), это снова сломало бы вывод типов select().
  const primaryQueries = flags.shadowEnabled ? buildQueries(FSRS_SELECT) : buildQueries(LEGACY_SELECT);
  const [
    { data: initialReviewRows, error: reviewError },
    { data: initialNewRows, error: newError },
  ] = await Promise.all([primaryQueries.reviewQuery, primaryQueries.newQuery]);
  // SrsStateRow объявляет fsrs_*-поля опциональными — приведение безопасно
  // независимо от того, каким из двух select() реально получены данные.
  let reviewRows = initialReviewRows as SrsStateRow[] | null;
  let newRows = initialNewRows as SrsStateRow[] | null;

  if (flags.shadowEnabled && (isMissingFsrsColumnsError(reviewError) || isMissingFsrsColumnsError(newError))) {
    // Легаси-select не содержит fsrs_*-полей — toCards() их и не читает,
    // пока не задать значения по умолчанию (см. ?? выше); форма отличается
    // только доп. полями, не структурой join'а — безопасно привести к общему
    // типу, аналогично src/app/(app)/brain/[deckId]/review/actions.ts.
    const fallback = buildQueries(LEGACY_SELECT);
    const [fallbackReview, fallbackNew] = await Promise.all([
      fallback.reviewQuery,
      fallback.newQuery,
    ]);
    reviewRows = fallbackReview.data as SrsStateRow[] | null;
    newRows = fallbackNew.data as SrsStateRow[] | null;
  }

  // Сначала карточки на повторение (не дать очереди повторов утонуть в новых
  // карточках), затем новые — раздел 6.2 роадмапа: два независимых лимита.
  const cards: ReviewCard[] = [...toCards(reviewRows), ...toCards(newRows)];

  // M3 Slice 4 §6: "deck/session title" в шапке ревью. "all" — синтетический
  // deckId (кросс-деково повторение, не реальная строка в decks) — честное
  // название вместо попытки найти несуществующую колоду.
  let sessionTitle = "Повторение";
  if (deckId !== "all") {
    const { data: deck } = await supabase.from("decks").select("name").eq("id", deckId).maybeSingle();
    if (deck) sessionTitle = deck.name;
  }

  const srsParams: SrsParams = {
    easyBonus: settings.easy_bonus,
    intervalModifier: settings.interval_modifier,
    maxIntervalDays: settings.max_interval_days,
    graduatingIntervalDays: settings.graduating_interval_days,
    easyIntervalDays: settings.easy_interval_days,
  };

  // M2 Learning Upgrade (LEARN-010) + FSRS Schema Compatibility Hotfix:
  // единственное место, где решается, какой алгоритм авторитетен —
  // server-side флаги (flags.enabled уже учитывает flags.schemaReady, см.
  // getFsrsFlags), не передаётся из клиента. Клиентский компонент получает
  // уже вычисленное значение только для выбора формулы предпросмотра
  // интервала на кнопках оценки; реальное сохранение (reviewWord) всё равно
  // проверяет флаги заново на сервере.

  return (
    <ReviewModeSwitcher
      cards={cards}
      studyDirection={settings.study_direction}
      srsParams={srsParams}
      bestSessionCount={profile.review_best_session_count}
      fsrsEnabled={flags.enabled}
      maxIntervalDays={settings.max_interval_days}
      sessionTitle={sessionTitle}
      targetLanguage={profile.target_language}
      userId={profile.id}
      sessionDeckId={deckId}
    />
  );
}
