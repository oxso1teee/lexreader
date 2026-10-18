import type { SupabaseServerClient } from "@/lib/supabase/server";
import { deriveVocabularyState, type LearningState, type ReviewSignal } from "./state-engine.ts";

// M3 Slice 10 (brief Phase C §10) — called after a review/mission completion writes to
// review_log. Recomputes learning_state fresh from real review_log/srs_state data every time
// (same "never trust a stored flag over source data" discipline as the FSRS/SM-2 pipeline
// itself) rather than incrementally patching a stored value.
const RECOMPUTE_WINDOW = 6; // matches state-engine.ts's EVIDENCE_WINDOW exactly
const LEARNING_STATE_VERSION = 1;

export interface LearningStateTransition {
  before: LearningState;
  after: LearningState;
}

// docs/moments/ROADMAP.md, этап 1: возвращает before/after (а не void) —
// Word-mastered-момент срабатывает ровно на переходе в "maintenance", и
// только вызывающий код (reviewWord) знает, что это тот самый, настоящий
// вызов, а не фоновый пересчёт мимо интересующего события.
export async function recomputeAndPersistLearningState(
  supabase: SupabaseServerClient,
  flashcardId: string,
): Promise<LearningStateTransition | null> {
  // Brief §27: the review write that already happened is the one that matters — a failure here
  // must never surface as a review failure, and there's nothing useful to retry synchronously
  // (the next real review recomputes fresh from source data regardless).
  try {
    const [{ data: card }, { data: logs }, { data: srs }] = await Promise.all([
      supabase.from("flashcards").select("learning_state").eq("id", flashcardId).maybeSingle(),
      supabase
        .from("review_log")
        .select("grade, practice_mode")
        .eq("flashcard_id", flashcardId)
        .order("reviewed_at", { ascending: false })
        .limit(RECOMPUTE_WINDOW),
      supabase.from("srs_state").select("interval_days, fsrs_stability").eq("flashcard_id", flashcardId).maybeSingle(),
    ]);
    if (!card) return null;

    const before = (card.learning_state ?? "new") as LearningState;

    const recentReviews: ReviewSignal[] = (logs ?? []).map((l) => ({
      grade: l.grade,
      mode: l.practice_mode as ReviewSignal["mode"],
    }));

    const after = deriveVocabularyState({
      recentReviews,
      intervalDays: srs?.interval_days ?? null,
      fsrsStability: srs?.fsrs_stability ?? null,
    });

    await supabase
      .from("flashcards")
      .update({
        learning_state: after,
        learning_state_version: LEARNING_STATE_VERSION,
        learning_state_updated_at: new Date().toISOString(),
      })
      .eq("id", flashcardId);

    return { before, after };
  } catch {
    // Swallowed deliberately — see comment above.
    return null;
  }
}
