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
): Promise<boolean> {
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
  if (!result.ok || !result.flashcardId) return false;

  await supabase.from("vocabulary_items").update({ flashcard_id: result.flashcardId }).eq("id", vocabularyItemId);
  return result.contextAdded ?? false;
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
    let contextAdded = false;
    if (existing.flashcard_id && input.contextSentence) {
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
      contextAdded = result.ok ? (result.contextAdded ?? false) : false;
    }

    return { ok: true, id: existing.id, level: existing.level, seenCount: existing.seen_count + 1, contextAdded };
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

  const contextAdded = await linkToFlashcard(supabase, userId, created.id, {
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

  return { ok: true, id: created.id, level: created.level, seenCount: created.seen_count, contextAdded };
}
