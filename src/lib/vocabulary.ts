import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getPlan, FREE_DAILY_WORD_LIMIT, hasFreeDeckRoom, hasFreeFlashcardRoom } from "@/lib/subscription";
import { checkAndAwardAchievements } from "@/lib/achievements-actions";
import { addXp } from "@/lib/xp-actions";

export interface UpsertWordResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
  id?: string;
  level?: number;
  seenCount?: number;
}

function todayStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

// P0-АУДИТ (раздел 5): .ilike() трактует % и _ как wildcard-символы — без
// экранирования слово вроде "50%" могло бы случайно совпасть с несвязанной
// записью.
export function escapeIlike(s: string): string {
  return s.replace(/[%_]/g, (c) => `\\${c}`);
}

// Слова из чтения и Мозг раньше жили как два не связанных друг с другом
// раздела — слово из Тетради никогда не попадало в настоящее интервальное
// повторение. Теперь каждое новое слово сразу получает карточку в колоде по
// умолчанию пользователя. Best-effort: если места в бесплатном тарифе на
// колоду/карточку не осталось — слово всё равно сохраняется для чтения, но
// молча остаётся вне повторения (никогда не блокируем сохранение из-за этого).
async function linkToDefaultDeck(
  supabase: SupabaseServerClient,
  userId: string,
  vocabularyItemId: string,
  input: {
    headword: string;
    translation: string;
    contextSentence: string | null;
    contextTranslation: string | null;
    photoUrl: string | null;
    textId: string | null;
    language: string;
  },
): Promise<void> {
  if (!(await hasFreeFlashcardRoom(supabase, userId))) return;

  let { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .eq("language", input.language)
    .maybeSingle();

  if (!deck) {
    if (!(await hasFreeDeckRoom(supabase, userId))) return;
    const { data: createdDeck } = await supabase
      .from("decks")
      .insert({ owner_id: userId, name: "Основная колода", is_default: true, language: input.language })
      .select("id")
      .single();
    if (!createdDeck) return;
    deck = createdDeck;
  }

  const { data: card } = await supabase
    .from("flashcards")
    .insert({
      deck_id: deck.id,
      owner_id: userId,
      front: input.headword,
      back: input.translation,
      photo_url: input.photoUrl,
      context_sentence: input.contextSentence,
      context_translation: input.contextTranslation,
      source_text_id: input.textId,
      language: input.language,
    })
    .select("id")
    .single();
  if (!card) return;

  const { data: settings } = await supabase
    .from("srs_settings")
    .select("starting_ease")
    .eq("owner_id", userId)
    .maybeSingle();

  await supabase.from("srs_state").insert({ flashcard_id: card.id, ease_factor: settings?.starting_ease ?? 2.5 });
  await supabase.from("vocabulary_items").update({ flashcard_id: card.id }).eq("id", vocabularyItemId);
}

export async function saveVocabularyItem(
  supabase: SupabaseServerClient,
  userId: string,
  input: {
    textId: string | null;
    headword: string;
    translation: string;
    contextSentence: string | null;
    contextTranslation: string | null;
    language: string;
  },
): Promise<UpsertWordResult> {
  // P0-АУДИТ 3.9: дедуп и апдейт теперь тоже скопированы по языку — иначе
  // слово с одинаковым написанием в двух изучаемых языках "склеивалось" бы
  // в одну запись.
  const { data: existing } = await supabase
    .from("vocabulary_items")
    .select("id, level, seen_count")
    .eq("owner_id", userId)
    .eq("language", input.language)
    .ilike("headword", escapeIlike(input.headword))
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("vocabulary_items")
      .update({ seen_count: existing.seen_count + 1 })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: existing.id, level: existing.level, seenCount: existing.seen_count + 1 };
  }

  const plan = await getPlan(supabase, userId);
  if (plan === "free") {
    const { count } = await supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .gte("created_at", todayStartUtc());
    if ((count ?? 0) >= FREE_DAILY_WORD_LIMIT) {
      return { ok: false, paywall: true };
    }
  }

  const { data: created, error } = await supabase
    .from("vocabulary_items")
    .insert({
      owner_id: userId,
      source_text_id: input.textId,
      headword: input.headword,
      translation: input.translation,
      context_sentence: input.contextSentence,
      context_translation: input.contextTranslation,
      language: input.language,
    })
    .select("id, level, seen_count")
    .single();
  if (error || !created) return { ok: false, error: "Не удалось сохранить слово. Попробуй ещё раз." };

  await linkToDefaultDeck(supabase, userId, created.id, {
    headword: input.headword,
    translation: input.translation,
    contextSentence: input.contextSentence,
    contextTranslation: input.contextTranslation,
    photoUrl: null,
    textId: input.textId,
    language: input.language,
  });

  // Раздел 5.2 промта: точка входа общая для читалки/ручного добавления/
  // "отправить в тетрадь" из Мозга — сюда стекается почти весь прогресс по
  // словарю, поэтому проверка достижений живёт именно здесь.
  await checkAndAwardAchievements(supabase, userId, input.language);
  await addXp(supabase, userId, 2);

  return { ok: true, id: created.id, level: created.level, seenCount: created.seen_count };
}
