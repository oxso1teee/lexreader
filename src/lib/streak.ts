import type { SupabaseServerClient } from "@/lib/supabase/server";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function touchStreak(supabase: SupabaseServerClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_current, streak_longest, last_active_date")
    .eq("id", userId)
    .single();
  if (!profile) return;

  const today = isoDate(new Date());
  if (profile.last_active_date === today) return;

  const yesterday = isoDate(new Date(Date.now() - 86_400_000));
  const newStreak = profile.last_active_date === yesterday ? profile.streak_current + 1 : 1;

  await supabase
    .from("profiles")
    .update({
      streak_current: newStreak,
      streak_longest: Math.max(newStreak, profile.streak_longest),
      last_active_date: today,
    })
    .eq("id", userId);
}
