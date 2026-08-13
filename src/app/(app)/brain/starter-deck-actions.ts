"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { translateText } from "@/lib/translate";
import { STARTER_DECKS, type StarterLevel } from "@/lib/starter-decks";
import { findOrCreateFlashcard } from "@/lib/vocabulary/save";

// Переводим на лету через тот же MyMemory-пайплайн, что и остальное
// приложение — партиями по 8, чтобы уложиться в разумное время ответа
// (см. maxDuration=45 в brain/page.tsx), а не бить квоту одним махом на
// 60 последовательных round-trip'ов.
const TRANSLATE_BATCH_SIZE = 8;
// translateText() сам по себе может делать до 3 попыток по 8с при сбоях
// сети — для одного медленного/зависшего слова это до ~24с. При партиях по
// 8 это грозит вылезти за maxDuration. Обрубаем каждое слово по отдельному
// таймауту пожёстче — пропущенное слово просто не попадёт в колоду.
const WORD_TIMEOUT_MS = 5_000;

function translateWithTimeout(word: string, sourceLang: string, targetLang: string): Promise<string | null> {
  return Promise.race([
    translateText(word, sourceLang, targetLang).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), WORD_TIMEOUT_MS)),
  ]);
}

// MyMemory — переводческая память (поиск похожих ранее переведённых фраз в
// корпусе), а не полноценный NMT — для отдельного слова без контекста
// предложения она временами отдаёт откровенный брак: мойибейк ("?????"),
// латиницу вместо кириллицы, или многословный ответ вместо перевода одного
// слова. Отсекаем такие случаи явными признаками — но семантически неверный,
// при этом грамматически правдоподобный перевод этим фильтром не поймать
// (ограничение самого сервиса, а не этой проверки).
const NON_LATIN_SCRIPT_LANGUAGES = new Set(["ru", "zh", "ja", "ko", "ar"]);
const LATIN_ONLY_RE = /^[a-zA-Z\s.,!?'-]+$/;

function isPlausibleTranslation(word: string, translation: string, nativeLanguage: string): boolean {
  const t = translation.trim();
  if (!t) return false;
  if (t.toLowerCase() === word.trim().toLowerCase()) return false;
  if (/\?{2,}/.test(t)) return false;
  if (t.length > word.length * 5 + 15) return false;
  if (NON_LATIN_SCRIPT_LANGUAGES.has(nativeLanguage) && LATIN_ONLY_RE.test(t)) return false;
  return true;
}

export interface AddStarterDeckResult {
  ok: boolean;
  error?: string;
}

export async function addStarterDeck(level: StarterLevel): Promise<AddStarterDeckResult> {
  const profile = await requireProfile();
  // Список слов — английский (см. lib/starter-decks.ts); переводить его
  // "на себя" при target_language !== "en" не имеет смысла.
  if (profile.target_language !== "en") {
    return { ok: false, error: "Стартовые колоды пока доступны только для английского." };
  }

  const def = STARTER_DECKS[level];
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", profile.id)
    .eq("language", profile.target_language)
    .eq("name", def.title)
    .maybeSingle();
  if (existing) return { ok: false, error: "Эта колода уже добавлена." };

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      owner_id: profile.id,
      name: def.title,
      language: profile.target_language,
      is_starter: true,
    })
    .select("id")
    .single();
  if (deckError || !deck) return { ok: false, error: "Не удалось создать колоду. Попробуй ещё раз." };

  const translations: (string | null)[] = new Array(def.words.length).fill(null);
  for (let i = 0; i < def.words.length; i += TRANSLATE_BATCH_SIZE) {
    const batch = def.words.slice(i, i + TRANSLATE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((word) => translateWithTimeout(word, profile.target_language, profile.native_language)),
    );
    results.forEach((r, j) => {
      translations[i + j] = r;
    });
  }

  const rows = def.words
    .map((word, i) => ({ word, translation: translations[i] }))
    .filter((r): r is { word: string; translation: string } => Boolean(r.translation))
    .filter((r) => isPlausibleTranslation(r.word, r.translation, profile.native_language));

  if (rows.length === 0) {
    await supabase.from("decks").delete().eq("id", deck.id);
    return { ok: false, error: "Не удалось перевести слова. Попробуй ещё раз позже." };
  }

  // M3 Slice 10 (brief Phase B §7) — starter decks previously had NO per-word dedup at all
  // (Phase A audit finding): re-adding a starter deck, or a starter word the user already had
  // from Reader/manual/import, silently created a duplicate flashcard every time. Routed
  // through the shared service now — an existing compatible flashcard (any source) is reused
  // instead, exactly like every other save path.
  // Deliberately not tracking a created-vs-reused count for a user-facing message here: even
  // when every word already existed as a flashcard elsewhere, the deck itself is still a real,
  // useful grouping (existing words now organized under it) — kept, never deleted for that
  // reason alone.
  for (const r of rows) {
    await findOrCreateFlashcard(supabase, {
      ownerId: profile.id,
      language: profile.target_language,
      front: r.word,
      back: r.translation,
      itemType: "word",
      sourceType: "starter_deck",
      deckId: deck.id,
      isStarter: true,
    });
  }

  revalidatePath("/brain");
  return { ok: true };
}
