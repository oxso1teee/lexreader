// Относительные импорты (не @/lib/...) — vocabulary-list.test.ts запускается
// напрямую через node --test без сборщика/tsconfig-paths, alias'ы там не
// резолвятся (тот же приём, что и в src/lib/fsrs-flags.ts).
import type { SupabaseServerClient } from "./supabase/server.ts";
import { isLearned } from "./srs.ts";

// M3 Slice 4 §9: единый список для Vocabulary (Words/Phrases/Decks) —
// `flashcards` как базовая таблица (это единственная реально связанная с SRS
// сущность; часть карточек создана вручную/импортом и вообще не имеет
// vocabulary_items), с отдельным best-effort merge по vocabulary_items для
// knowledge-level/favorite там, где карточка пришла из Тетради (0028). Слово
// vs фраза — то же самое клиентское правило, что и в Reader (reader.tsx:390,
// `text.includes(" ")`), не отдельная колонка схемы.
export type SchedulerBucket = "new" | "due" | "learning" | "known";
export type ItemType = "word" | "phrase";
export type LearningState = "new" | "learning" | "familiar" | "active" | "maintenance";
export type SourceType = "reader" | "manual" | "import_bulk" | "starter_deck" | "mission" | "path";

export interface VocabularyRow {
  flashcardId: string;
  front: string;
  back: string;
  notes: string | null;
  /** M3 Slice 10 — sourced from the real flashcards.item_type column, not the front.includes(" ") heuristic. */
  isPhrase: boolean;
  itemType: ItemType;
  learningState: LearningState;
  sourceType: SourceType;
  /** Count only — full context text/translations are lazy-loaded on the detail page, never here. */
  contextCount: number;
  contextSentence: string | null;
  contextTranslation: string | null;
  photoUrl: string | null;
  sourceTextId: string | null;
  sourceTextTitle: string | null;
  deckId: string;
  deckName: string;
  isDefaultDeck: boolean;
  isStarterDeck: boolean;
  vocabularyItemId: string | null;
  knowledgeStatus: "new" | "learning" | "known" | "ignored" | null;
  isFavorite: boolean;
  dueAt: string;
  firstReviewedAt: string | null;
  repetitions: number;
  reps: number;
  createdAt: string;
  schedulerBucket: SchedulerBucket;
  /** Cumulative accuracy from review_log (grade>=2 counts as success), null if never graded. Same reviewed_at-scoped source as computeHardestWords, just per-row instead of top-N. */
  accuracy: number | null;
  totalReviews: number;
}

interface FlashcardRow {
  id: string;
  front: string;
  back: string;
  notes: string | null;
  item_type: ItemType;
  learning_state: LearningState;
  source_type: SourceType;
  context_sentence: string | null;
  context_translation: string | null;
  photo_url: string | null;
  source_text_id: string | null;
  created_at: string;
  deck_id: string;
  decks: { name: string; is_default: boolean; is_starter: boolean } | { name: string; is_default: boolean; is_starter: boolean }[] | null;
  srs_state:
    | { due_at: string; first_reviewed_at: string | null; repetitions: number; interval_days: number; ease_factor: number }
    | { due_at: string; first_reviewed_at: string | null; repetitions: number; interval_days: number; ease_factor: number }[]
    | null;
  texts: { title: string } | { title: string }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function bucketFor(firstReviewedAt: string | null, dueAt: string, repetitions: number, intervalDays: number): SchedulerBucket {
  if (firstReviewedAt === null) return "new";
  if (new Date(dueAt).getTime() <= Date.now()) return "due";
  return isLearned({ easeFactor: 0, intervalDays, repetitions }) ? "known" : "learning";
}

export async function getVocabularyRows(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<VocabularyRow[]> {
  const [{ data: cards }, { data: vocabItems }, { data: logs }, { data: contexts }] = await Promise.all([
    supabase
      .from("flashcards")
      .select(
        "id, front, back, notes, item_type, learning_state, source_type, context_sentence, context_translation, photo_url, source_text_id, created_at, deck_id, decks(name, is_default, is_starter), srs_state(due_at, first_reviewed_at, repetitions, interval_days, ease_factor), texts(title)",
      )
      .eq("owner_id", ownerId)
      .eq("language", language),
    supabase
      .from("vocabulary_items")
      .select("id, flashcard_id, status, is_favorite")
      .eq("owner_id", ownerId)
      .eq("language", language)
      .not("flashcard_id", "is", null),
    // Та же идея, что и computeHardestWords (src/lib/brain-stats.ts) — здесь
    // считаем точность/число повторов на каждую карточку, а не только топ-N
    // худших, для честной сортировки "Сложные"/"Больше всего повторений".
    supabase
      .from("review_log")
      .select("flashcard_id, grade, flashcards!inner(owner_id, language)")
      .eq("flashcards.owner_id", ownerId)
      .eq("flashcards.language", language),
    // M3 Slice 10 — count only (flashcard_id, a uuid), never context text/translation here:
    // the list view must stay a summary query (plan doc §51/brief §21) — full context content
    // is lazy-loaded on the detail page.
    supabase
      .from("vocabulary_contexts")
      .select("flashcard_id, flashcards!inner(owner_id, language)")
      .eq("flashcards.owner_id", ownerId)
      .eq("flashcards.language", language),
  ]);

  const vocabByFlashcard = new Map(
    (vocabItems ?? [])
      .filter((v): v is typeof v & { flashcard_id: string } => v.flashcard_id !== null)
      .map((v) => [v.flashcard_id, v]),
  );

  const accuracyByFlashcard = new Map<string, { total: number; success: number }>();
  for (const log of logs ?? []) {
    const acc = accuracyByFlashcard.get(log.flashcard_id) ?? { total: 0, success: 0 };
    acc.total += 1;
    if (log.grade >= 2) acc.success += 1;
    accuracyByFlashcard.set(log.flashcard_id, acc);
  }

  const contextCountByFlashcard = new Map<string, number>();
  for (const ctx of contexts ?? []) {
    contextCountByFlashcard.set(ctx.flashcard_id, (contextCountByFlashcard.get(ctx.flashcard_id) ?? 0) + 1);
  }

  return ((cards ?? []) as unknown as FlashcardRow[]).flatMap((row) => {
    const deck = one(row.decks);
    const srs = one(row.srs_state);
    const text = one(row.texts);
    if (!deck || !srs) return [];
    const vocab = vocabByFlashcard.get(row.id) ?? null;
    const acc = accuracyByFlashcard.get(row.id) ?? null;
    return [
      {
        flashcardId: row.id,
        front: row.front,
        back: row.back,
        notes: row.notes,
        isPhrase: row.item_type === "phrase",
        itemType: row.item_type,
        learningState: row.learning_state,
        sourceType: row.source_type,
        contextCount: contextCountByFlashcard.get(row.id) ?? 0,
        contextSentence: row.context_sentence,
        contextTranslation: row.context_translation,
        photoUrl: row.photo_url,
        sourceTextId: row.source_text_id,
        sourceTextTitle: text?.title ?? null,
        deckId: row.deck_id,
        deckName: deck.name,
        isDefaultDeck: deck.is_default,
        isStarterDeck: deck.is_starter,
        vocabularyItemId: vocab?.id ?? null,
        knowledgeStatus: (vocab?.status as VocabularyRow["knowledgeStatus"]) ?? null,
        isFavorite: vocab?.is_favorite ?? false,
        dueAt: srs.due_at,
        firstReviewedAt: srs.first_reviewed_at,
        repetitions: srs.repetitions,
        reps: srs.repetitions,
        createdAt: row.created_at,
        schedulerBucket: bucketFor(srs.first_reviewed_at, srs.due_at, srs.repetitions, srs.interval_days),
        accuracy: acc ? acc.success / acc.total : null,
        totalReviews: acc?.total ?? 0,
      },
    ];
  });
}
