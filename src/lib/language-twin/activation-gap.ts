import type { SupabaseServerClient } from "@/lib/supabase/server";

// Flagship v1 pattern (plan doc §6): a word the user has engaged with enough
// in Reading to reach "Знаю" but still fails on review is real, honest,
// zero-new-input evidence that recognition and recall are different skills.
// READING_KNOWN_LEVEL matches the Reader's own 5-level scale (src/lib/types.ts
// comment: "0 Новое…4 Овладел") — level 4 is literally "Знаю"/"Овладел".
const READING_KNOWN_LEVEL = 4;
// Same "don't trust under 3 attempts" convention as brain-stats.ts's
// MIN_ATTEMPTS_FOR_ACCURACY — kept as an independent constant (see
// confidence.ts for the same note).
const MIN_REVIEW_ATTEMPTS = 3;
// Below this accuracy, a "known" reading word is failing review often enough
// to call out — chosen so a single slip (e.g. 2/3 correct = 67%) doesn't
// trigger a false pattern.
const GAP_ACCURACY_THRESHOLD = 0.6;

export interface ActivationCandidate {
  vocabularyItemId: string;
  flashcardId: string;
  headword: string;
  translation: string;
  readingLevel: number;
  reviewGrades: { grade: number; reviewedAt: string }[];
}

export interface ActivationGapWord {
  vocabularyItemId: string;
  flashcardId: string;
  headword: string;
  translation: string;
  totalAttempts: number;
  accuracy: number;
  lastReviewedAt: string;
}

// Pure — no I/O, fully unit-testable.
export function detectActivationGaps(candidates: ActivationCandidate[]): ActivationGapWord[] {
  const gaps: ActivationGapWord[] = [];
  for (const c of candidates) {
    if (c.readingLevel < READING_KNOWN_LEVEL) continue;
    if (c.reviewGrades.length < MIN_REVIEW_ATTEMPTS) continue;
    const success = c.reviewGrades.filter((g) => g.grade >= 2).length;
    const accuracy = success / c.reviewGrades.length;
    if (accuracy >= GAP_ACCURACY_THRESHOLD) continue;
    const lastReviewedAt = c.reviewGrades.reduce(
      (latest, g) => (g.reviewedAt > latest ? g.reviewedAt : latest),
      c.reviewGrades[0].reviewedAt,
    );
    gaps.push({
      vocabularyItemId: c.vocabularyItemId,
      flashcardId: c.flashcardId,
      headword: c.headword,
      translation: c.translation,
      totalAttempts: c.reviewGrades.length,
      accuracy,
      lastReviewedAt,
    });
  }
  return gaps.sort((a, b) => a.accuracy - b.accuracy);
}

// Data-gathering wrapper — the only place this pattern touches the DB.
// vocabulary_items.flashcard_id (migration 0028) is what makes this join
// possible without any new schema.
export async function getActivationCandidates(
  supabase: SupabaseServerClient,
  userId: string,
  language: string,
): Promise<ActivationCandidate[]> {
  const { data: items } = await supabase
    .from("vocabulary_items")
    .select("id, headword, translation, level, flashcard_id")
    .eq("owner_id", userId)
    .eq("language", language)
    .not("flashcard_id", "is", null)
    .gte("level", READING_KNOWN_LEVEL);
  if (!items || items.length === 0) return [];

  const flashcardIds = items.map((i) => i.flashcard_id as string);
  const { data: logs } = await supabase
    .from("review_log")
    .select("flashcard_id, grade, reviewed_at")
    .in("flashcard_id", flashcardIds);

  const logsByCard = new Map<string, { grade: number; reviewedAt: string }[]>();
  for (const row of logs ?? []) {
    const arr = logsByCard.get(row.flashcard_id) ?? [];
    arr.push({ grade: row.grade, reviewedAt: row.reviewed_at });
    logsByCard.set(row.flashcard_id, arr);
  }

  return items.map((i) => ({
    vocabularyItemId: i.id,
    flashcardId: i.flashcard_id as string,
    headword: i.headword,
    translation: i.translation,
    readingLevel: i.level,
    reviewGrades: logsByCard.get(i.flashcard_id as string) ?? [],
  }));
}
