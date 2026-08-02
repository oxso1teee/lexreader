import type { SupabaseServerClient } from "@/lib/supabase/server";

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
