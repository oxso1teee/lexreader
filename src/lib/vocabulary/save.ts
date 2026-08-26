import type { SupabaseServerClient } from "@/lib/supabase/server";
import { hasFreeDeckRoom, hasFreeFlashcardRoom } from "@/lib/subscription";
import { deriveItemType, normalizeVocabularyKey, type ItemType } from "./item-type";

// M3 Slice 10 (plan doc §3, brief Phase B §4/§7) — the one place that decides "does a
// compatible flashcard already exist" for every save path (Reader word, Reader phrase, manual
// add, and — where safe — bulk import/starter decks). Reuses the real, approved
// flashcards.normalized_key + item_type columns from migration 0041 instead of the five
// previously-independent ad hoc checks the Phase A audit found. Existing duplicate rows from
// before this slice are never touched here — this only prevents new ones.

// "extension" (0048_extension_api_tokens.sql) — a word/phrase tapped on an arbitrary
// third-party page via the browser extension's tap-to-translate feature, not through any
// LexReader-imported text. See docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C,
// Тир 3.
export type VocabularySourceType = "reader" | "manual" | "import_bulk" | "starter_deck" | "mission" | "path" | "extension";
export type ContextSourceType = "reader" | "manual" | "import" | "video" | "extension";

export interface VocabularyContextInput {
  text: string;
  translation: string | null;
  sourceTextId: string | null;
  sourceType: ContextSourceType;
  /** M3 Slice 12 Gate #3 — video playback position (ms) this context was captured at,
   *  null/undefined for every non-video context (migration 0043). */
  sourceTimestampMs?: number | null;
}

export interface FindOrCreateFlashcardInput {
  ownerId: string;
  language: string;
  front: string;
  back: string;
  sourceType: VocabularySourceType;
  itemType?: ItemType;
  deckId?: string;
  isStarter?: boolean;
  notes?: string | null;
  context?: VocabularyContextInput | null;
}

export interface FindOrCreateFlashcardResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
  flashcardId?: string;
  /** false when an existing compatible flashcard was reused instead of a new one being created. */
  created?: boolean;
  /** true when a genuinely new (non-duplicate) context row was appended for this flashcard. */
  contextAdded?: boolean;
}

async function resolveDeck(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<{ id: string } | "paywall" | null> {
  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("is_default", true)
    .eq("language", language)
    .maybeSingle();
  if (deck) return deck;

  if (!(await hasFreeDeckRoom(supabase, ownerId))) return "paywall";

  const { data: created } = await supabase
    .from("decks")
    .insert({ owner_id: ownerId, name: "Основная колода", is_default: true, language })
    .select("id")
    .single();
  return created ?? null;
}

// Dedup by exact trimmed text within this flashcard's own contexts — deterministic, no fuzzy
// matching (plan doc §3: "avoid duplicate identical contexts... need deterministic dedup").
async function appendContextIfNew(
  supabase: SupabaseServerClient,
  flashcardId: string,
  context: VocabularyContextInput | null | undefined,
): Promise<boolean> {
  if (!context) return false;
  const text = context.text.trim();
  if (!text) return false;

  const { data: existing } = await supabase
    .from("vocabulary_contexts")
    .select("id")
    .eq("flashcard_id", flashcardId)
    .eq("context_text", text)
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase.from("vocabulary_contexts").insert({
    flashcard_id: flashcardId,
    context_text: text,
    context_translation: context.translation,
    source_text_id: context.sourceTextId,
    source_type: context.sourceType,
    source_timestamp_ms: context.sourceTimestampMs ?? null,
  });
  return !error;
}

export async function findOrCreateFlashcard(
  supabase: SupabaseServerClient,
  input: FindOrCreateFlashcardInput,
): Promise<FindOrCreateFlashcardResult> {
  const itemType = input.itemType ?? deriveItemType(input.front);
  const normalizedKey = normalizeVocabularyKey(input.front);

  // .maybeSingle() would throw on more than one match — and pre-existing duplicate flashcards
  // are a known, confirmed reality this migration deliberately did not clean up (plan doc §6:
  // 73 duplicate groups in production as of this slice). Take the oldest match deterministically
  // instead of erroring — silently falling through to "create new" here would make the exact
  // problem this function exists to prevent worse, not better.
  const { data: existingMatches } = await supabase
    .from("flashcards")
    .select("id")
    .eq("owner_id", input.ownerId)
    .eq("language", input.language)
    .eq("normalized_key", normalizedKey)
    .eq("item_type", itemType)
    .order("created_at", { ascending: true })
    .limit(1);
  const existing = existingMatches?.[0] ?? null;

  if (existing) {
    const contextAdded = await appendContextIfNew(supabase, existing.id, input.context);
    return { ok: true, flashcardId: existing.id, created: false, contextAdded };
  }

  if (!(await hasFreeFlashcardRoom(supabase, input.ownerId))) {
    return { ok: false, paywall: true };
  }

  let deckId = input.deckId ?? null;
  if (!deckId) {
    const deck = await resolveDeck(supabase, input.ownerId, input.language);
    if (deck === "paywall") return { ok: false, paywall: true };
    if (!deck) return { ok: false, error: "Не удалось создать колоду." };
    deckId = deck.id;
  }

  const contextText = input.context?.text.trim() || null;
  const { data: card, error } = await supabase
    .from("flashcards")
    .insert({
      deck_id: deckId,
      owner_id: input.ownerId,
      front: input.front,
      back: input.back,
      language: input.language,
      item_type: itemType,
      normalized_key: normalizedKey,
      source_type: input.sourceType,
      is_starter: input.isStarter ?? false,
      notes: input.notes ?? null,
      // Legacy single-slot columns kept in sync on creation only (plan doc §3.6) — any reader
      // that hasn't migrated to vocabulary_contexts (e.g. api/export/vocabulary) still sees the
      // first real context; they're never overwritten again after this.
      context_sentence: contextText,
      context_translation: contextText ? input.context?.translation ?? null : null,
      source_text_id: input.context?.sourceTextId ?? null,
    })
    .select("id")
    .single();
  if (error || !card) return { ok: false, error: "Не удалось сохранить карточку. Попробуй ещё раз." };

  const { data: settings } = await supabase
    .from("srs_settings")
    .select("starting_ease")
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  await supabase.from("srs_state").insert({ flashcard_id: card.id, ease_factor: settings?.starting_ease ?? 2.5 });

  const contextAdded = await appendContextIfNew(supabase, card.id, input.context);

  return { ok: true, flashcardId: card.id, created: true, contextAdded };
}
