import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getPlan, FREE_DAILY_WORD_LIMIT } from "@/lib/subscription";
import { checkAndAwardAchievements } from "@/lib/achievements-actions";
import { addXp } from "@/lib/xp-actions";
import { recordEvidence } from "@/lib/language-twin/evidence";
import { escapeIlike } from "./ilike";
import { findOrCreateFlashcard } from "./vocabulary/save";

export { escapeIlike };

export interface UpsertWordResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
  id?: string;
  level?: number;
  seenCount?: number;
  /** M3 Slice 10 — true when this exact context sentence was newly recorded (either on first
   *  save, or appended to an already-known word/flashcard from a new occurrence). */
  contextAdded?: boolean;
  /** M3 Slice 11 (plan doc §2, Practice Bridge) — the real flashcard this word is linked to,
   *  so Reader can show its actual learning_state and route straight into a targeted review. */
  flashcardId?: string;
  deckId?: string;
  learningState?: string;
  contextCount?: number;
}

function todayStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

// Слова из чтения и Мозг раньше жили как два не связанных друг с другом
// раздела — слово из Тетради никогда не попадало в настоящее интервальное
// повторение. Теперь каждое новое слово сразу получает карточку (переиспользуя
// уже существующую совместимую карточку, если такая есть — M3 Slice 10,
// findOrCreateFlashcard) в колоде по умолчанию пользователя. Best-effort: если
// места в бесплатном тарифе на колоду/карточку не осталось — слово всё равно
// сохраняется для чтения, но молча остаётся вне повторения (никогда не
// блокируем сохранение из-за этого).
interface FlashcardLinkInfo {
  contextAdded: boolean;
  flashcardId: string;
  deckId: string;
  learningState: string;
  contextCount: number;
}

// M3 Slice 11 (plan doc §2) — reads back deck_id/learning_state/context count right after
// find-or-create so callers (Reader's word panel) can show the real Practice Bridge state
// without a second round trip from the client.
async function fetchFlashcardLinkInfo(
  supabase: SupabaseServerClient,
  flashcardId: string,
  contextAdded: boolean,
): Promise<FlashcardLinkInfo> {
  const [{ data: flashcard }, { count }] = await Promise.all([
    supabase.from("flashcards").select("deck_id, learning_state").eq("id", flashcardId).maybeSingle(),
    supabase.from("vocabulary_contexts").select("id", { count: "exact", head: true }).eq("flashcard_id", flashcardId),
  ]);
  return {
    contextAdded,
    flashcardId,
    deckId: flashcard?.deck_id ?? "",
    learningState: flashcard?.learning_state ?? "new",
    contextCount: count ?? 0,
  };
}

// M3 Slice 11 (plan doc §2) — the repeat-save branch of saveVocabularyItem: append a new
// context occurrence to the already-linked flashcard when the sentence is genuinely new,
// otherwise just read back its current state. Kept separate from linkToFlashcard (which only
// runs on first save) since this one skips the deck/normalized_key resolution entirely.
async function refreshExistingLink(
  supabase: SupabaseServerClient,
  userId: string,
  flashcardId: string,
  input: {
    headword: string;
    translation: string;
    contextSentence: string | null;
    contextTranslation: string | null;
    textId: string | null;
    language: string;
  },
): Promise<FlashcardLinkInfo | null> {
  if (!input.contextSentence) return fetchFlashcardLinkInfo(supabase, flashcardId, false);

  const result = await findOrCreateFlashcard(supabase, {
    ownerId: userId,
    language: input.language,
    front: input.headword,
    back: input.translation,
    itemType: "word",
    sourceType: input.textId ? "reader" : "manual",
    context: {
      text: input.contextSentence,
      translation: input.contextTranslation,
      sourceTextId: input.textId,
      sourceType: input.textId ? "reader" : "manual",
    },
  });
  if (!result.ok || !result.flashcardId) return null;
  return fetchFlashcardLinkInfo(supabase, result.flashcardId, result.contextAdded ?? false);
}

async function linkToFlashcard(
  supabase: SupabaseServerClient,
  userId: string,
  vocabularyItemId: string,
  input: {
    headword: string;
    translation: string;
    contextSentence: string | null;
    contextTranslation: string | null;
    textId: string | null;
    language: string;
  },
): Promise<FlashcardLinkInfo | null> {
  const result = await findOrCreateFlashcard(supabase, {
    ownerId: userId,
    language: input.language,
    front: input.headword,
    back: input.translation,
    itemType: "word",
    sourceType: input.textId ? "reader" : "manual",
    context: input.contextSentence
      ? {
          text: input.contextSentence,
          translation: input.contextTranslation,
          sourceTextId: input.textId,
          sourceType: input.textId ? "reader" : "manual",
        }
      : null,
  });
  if (!result.ok || !result.flashcardId) return null;

  await supabase.from("vocabulary_items").update({ flashcard_id: result.flashcardId }).eq("id", vocabularyItemId);
  return fetchFlashcardLinkInfo(supabase, result.flashcardId, result.contextAdded ?? false);
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
    .select("id, level, seen_count, flashcard_id")
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

    // M3 Slice 10 (brief Phase B §5) — a repeat save from a new sentence used to silently
    // discard the context entirely; now it's appended as a real new occurrence for the
    // already-linked flashcard (deduped against identical text by findOrCreateFlashcard).
    // M3 Slice 11 (plan doc §2) — also self-heals a missing link (older row from before this
    // dual-write existed) so the Practice Bridge works for every saved word, not just new ones.
    const link = existing.flashcard_id
      ? await refreshExistingLink(supabase, userId, existing.flashcard_id, {
          headword: input.headword,
          translation: input.translation,
          contextSentence: input.contextSentence,
          contextTranslation: input.contextTranslation,
          textId: input.textId,
          language: input.language,
        })
      : await linkToFlashcard(supabase, userId, existing.id, {
          headword: input.headword,
          translation: input.translation,
          contextSentence: input.contextSentence,
          contextTranslation: input.contextTranslation,
          textId: input.textId,
          language: input.language,
        });

    return {
      ok: true,
      id: existing.id,
      level: existing.level,
      seenCount: existing.seen_count + 1,
      contextAdded: link?.contextAdded ?? false,
      flashcardId: link?.flashcardId,
      deckId: link?.deckId,
      learningState: link?.learningState,
      contextCount: link?.contextCount,
    };
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

  const link = await linkToFlashcard(supabase, userId, created.id, {
    headword: input.headword,
    translation: input.translation,
    contextSentence: input.contextSentence,
    contextTranslation: input.contextTranslation,
    textId: input.textId,
    language: input.language,
  });

  // Раздел 5.2 промта: точка входа общая для читалки/ручного добавления/
  // "отправить в тетрадь" из Мозга — сюда стекается почти весь прогресс по
  // словарю, поэтому проверка достижений живёт именно здесь.
  await checkAndAwardAchievements(supabase, userId, input.language);
  await addXp(supabase, userId, 2);

  // M3 Slice 5: только новое слово, не повторный просмотр — иначе повторные
  // подсказки одного и того же слова засоряли бы Evidence Explorer дублями.
  await recordEvidence(supabase, {
    userId,
    evidenceType: "vocabulary_saved",
    sourceType: "vocabulary_item",
    sourceId: created.id,
    result: "new_word",
    confidence: "low",
  });

  return {
    ok: true,
    id: created.id,
    level: created.level,
    seenCount: created.seen_count,
    contextAdded: link?.contextAdded ?? false,
    flashcardId: link?.flashcardId,
    deckId: link?.deckId,
    learningState: link?.learningState,
    contextCount: link?.contextCount,
  };
}
