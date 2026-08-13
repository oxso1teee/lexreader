import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/product/page-header";
import { bucketFor, type SchedulerBucket, type ItemType, type LearningState, type SourceType } from "@/lib/vocabulary-list";
import VocabularyItemDetail from "./detail-view";

export interface VocabularyContextRow {
  id: string;
  contextText: string;
  contextTranslation: string | null;
  sourceTextId: string | null;
  sourceTextTitle: string | null;
  createdAt: string;
}

export interface VocabularyDetail {
  flashcardId: string;
  front: string;
  back: string;
  notes: string | null;
  itemType: ItemType;
  learningState: LearningState;
  sourceType: SourceType;
  deckId: string;
  deckName: string;
  vocabularyItemId: string | null;
  knowledgeStatus: "new" | "learning" | "known" | "ignored" | null;
  schedulerBucket: SchedulerBucket;
  dueAt: string;
  totalReviews: number;
  accuracy: number | null;
  createdAt: string;
  contexts: VocabularyContextRow[];
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function VocabularyItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: card }, { data: contexts }, { data: vocabItem }, { data: logs }, { data: decks }] = await Promise.all([
    supabase
      .from("flashcards")
      .select(
        "id, front, back, notes, item_type, learning_state, source_type, created_at, deck_id, decks(name), srs_state(due_at, first_reviewed_at, repetitions, interval_days)",
      )
      .eq("id", id)
      .eq("owner_id", profile.id)
      .maybeSingle(),
    // Detail page is the one place full context text/translation is ever fetched (plan doc
    // §51/brief §21 — the list query only ever sees a count).
    supabase
      .from("vocabulary_contexts")
      .select("id, context_text, context_translation, source_text_id, created_at, texts(title)")
      .eq("flashcard_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("vocabulary_items").select("id, status").eq("flashcard_id", id).maybeSingle(),
    supabase.from("review_log").select("grade").eq("flashcard_id", id),
    supabase
      .from("decks")
      .select("id, name")
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .order("is_default", { ascending: false }),
  ]);

  if (!card) notFound();

  const deck = one(card.decks as { name: string } | { name: string }[] | null);
  const srs = one(
    card.srs_state as
      | { due_at: string; first_reviewed_at: string | null; repetitions: number; interval_days: number }
      | { due_at: string; first_reviewed_at: string | null; repetitions: number; interval_days: number }[]
      | null,
  );

  const totalReviews = logs?.length ?? 0;
  const successCount = (logs ?? []).filter((l) => l.grade >= 2).length;

  const detail: VocabularyDetail = {
    flashcardId: card.id,
    front: card.front,
    back: card.back,
    notes: card.notes,
    itemType: card.item_type,
    learningState: card.learning_state,
    sourceType: card.source_type,
    deckId: card.deck_id,
    deckName: deck?.name ?? "",
    vocabularyItemId: vocabItem?.id ?? null,
    knowledgeStatus: (vocabItem?.status as VocabularyDetail["knowledgeStatus"]) ?? null,
    schedulerBucket: srs ? bucketFor(srs.first_reviewed_at, srs.due_at, srs.repetitions, srs.interval_days) : "new",
    dueAt: srs?.due_at ?? new Date().toISOString(),
    totalReviews,
    accuracy: totalReviews > 0 ? successCount / totalReviews : null,
    createdAt: card.created_at,
    contexts: (contexts ?? []).map((c) => {
      const text = one(c.texts as { title: string } | { title: string }[] | null);
      return {
        id: c.id,
        contextText: c.context_text,
        contextTranslation: c.context_translation,
        sourceTextId: c.source_text_id,
        sourceTextTitle: text?.title ?? null,
        createdAt: c.created_at,
      };
    }),
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader
        title={detail.front}
        description={detail.itemType === "phrase" ? "Фраза" : "Слово"}
        action={
          <Link
            href="/brain/vocabulary"
            className="focus-ring flex min-h-11 items-center rounded-full border border-black/10 px-3 text-sm font-medium text-[var(--text-secondary)] dark:border-white/15"
          >
            ← Словарь
          </Link>
        }
      />
      <VocabularyItemDetail detail={detail} decks={(decks ?? []).map((d) => ({ id: d.id, name: d.name }))} />
    </div>
  );
}
