import type { SupabaseServerClient } from "@/lib/supabase/server";

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 9.1: без ИИ — просто мода
// (самый частый час) по последним отметкам активности. Пока данных мало,
// используем разумный дефолт вместо случайного часа.
const DEFAULT_NOTIFY_HOUR = 19;
const MIN_SAMPLES = 10;

export async function computePreferredHour(
  supabase: SupabaseServerClient,
  ownerId: string,
): Promise<number> {
  const { data } = await supabase
    .from("review_log")
    .select("reviewed_at, flashcards!inner(owner_id)")
    .eq("flashcards.owner_id", ownerId)
    .order("reviewed_at", { ascending: false })
    .limit(200);

  if (!data || data.length < MIN_SAMPLES) return DEFAULT_NOTIFY_HOUR;

  const buckets = new Array(24).fill(0);
  for (const row of data) buckets[new Date(row.reviewed_at).getUTCHours()]++;
  return buckets.indexOf(Math.max(...buckets));
}
