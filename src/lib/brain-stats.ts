import type { SupabaseServerClient } from "@/lib/supabase/server";

// Practice Home "estimated duration" (Slice 4 §5): deterministic, no AI, no
// false precision. 20s/card covers read+flip+decide for a plain flashcard —
// deliberately a round, documented constant rather than a measured average
// (no per-card timing is tracked anywhere), and the UI always renders the
// result as a rounded "~N мин", never a false-precision exact figure.
const AVG_SECONDS_PER_CARD = 20;

export function estimateReviewMinutes(cardCount: number): number {
  if (cardCount <= 0) return 0;
  return Math.max(1, Math.round((cardCount * AVG_SECONDS_PER_CARD) / 60));
}

export interface HardestWord {
  id: string;
  front: string;
  back: string;
  accuracy: number;
  total: number;
}

// Ниже скольки попыток слово не попадает в рейтинг "сложных" — одна
// случайная "Не помню" в начале иначе даёт 0% точности и лезет в топ раньше
// слов, которые реально трудны на длинной дистанции.
const MIN_ATTEMPTS_FOR_ACCURACY = 3;

export function computeHardestWords(
  logs: { flashcard_id: string; grade: number; flashcards: unknown }[],
  limit: number,
): HardestWord[] {
  const byCard = new Map<string, { front: string; back: string; total: number; success: number }>();
  for (const row of logs) {
    const card = row.flashcards as unknown as { front: string; back: string } | null;
    if (!card) continue;
    const existing = byCard.get(row.flashcard_id) ?? {
      front: card.front,
      back: card.back,
      total: 0,
      success: 0,
    };
    existing.total += 1;
    if (row.grade >= 2) existing.success += 1;
    byCard.set(row.flashcard_id, existing);
  }

  return [...byCard.entries()]
    .filter(([, v]) => v.total >= MIN_ATTEMPTS_FOR_ACCURACY)
    .map(([id, v]) => ({ id, front: v.front, back: v.back, accuracy: v.success / v.total, total: v.total }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}

// M3 Slice 4 — Practice Home "weak words": same query+ranking Progress
// already uses (§9 of the plan doc explicitly says reuse, not reimplement).
// Accuracy is cumulative all-time, not scoped to any period tab.
export async function getHardestWords(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  limit: number,
): Promise<HardestWord[]> {
  const { data } = await supabase
    .from("review_log")
    .select("flashcard_id, grade, flashcards!inner(front, back, owner_id, language)")
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language);
  return computeHardestWords(data ?? [], limit);
}

export async function getDueCount(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<number> {
  const { count } = await supabase
    .from("srs_state")
    .select("flashcard_id, flashcards!inner(owner_id, language)", { count: "exact", head: true })
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language)
    .lte("due_at", new Date().toISOString());
  return count ?? 0;
}

// M3 Slice 1 — Today "Progress Snapshot" (docs/ui/unified-ui-slice-1-plan.md):
// реальный счётчик повторений за 7 дней, тот же join-паттерн, что и у
// getDueCount выше — review_log не хранит owner_id напрямую.
export async function getReviewsThisWeekCount(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count } = await supabase
    .from("review_log")
    .select("id, flashcards!inner(owner_id, language)", { count: "exact", head: true })
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language)
    .gte("reviewed_at", weekAgo);
  return count ?? 0;
}

// M3 Slice 4 — Practice Home "daily progress": same join pattern as
// getReviewsThisWeekCount above, scoped to UTC-today instead of 7 days.
export async function getReviewsTodayCount(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("review_log")
    .select("id, flashcards!inner(owner_id, language)", { count: "exact", head: true })
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language)
    .gte("reviewed_at", todayStart.toISOString());
  return count ?? 0;
}

// Мозг Study Settings (§6.2 of the roadmap) already caps new cards/day —
// reused here so Practice Home's "new count" matches what the review queue
// will actually introduce, not the deck's total new-card backlog.
export async function getNewCardsRemainingToday(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  newCardsPerDay: number,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: alreadyIntroducedToday } = await supabase
    .from("srs_state")
    .select("flashcard_id, flashcards!inner(owner_id, language)", { count: "exact", head: true })
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language)
    .gte("first_reviewed_at", todayStart.toISOString());
  return Math.max(0, newCardsPerDay - (alreadyIntroducedToday ?? 0));
}

// Count of new (never-reviewed) cards actually due to show right now —
// mirrors the `newQuery` half of review/page.tsx's queue builder without
// duplicating its full query (that one also joins flashcard content, this
// one only needs a count for the Practice Home preview).
export async function getAvailableNewCount(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<number> {
  const { count } = await supabase
    .from("srs_state")
    .select("flashcard_id, flashcards!inner(owner_id, language)", { count: "exact", head: true })
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language)
    .is("first_reviewed_at", null)
    .lte("due_at", new Date().toISOString());
  return count ?? 0;
}
