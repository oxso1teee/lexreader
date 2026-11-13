import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Moment } from "./types";

// docs/moments/ROADMAP.md, этап 7 — Notify-ask "после первого занятия".
// completed_first_win раньше выставлялся только из Learning Path
// (applySkillProgressPatch-ветка в learning-paths/actions.ts) — с новым
// онбордингом (Splash -> ... -> First-text -> читалка, без форсированной
// записи в путь) первое реальное занятие — это reviewWord()/finishReading(),
// поэтому именно здесь теперь выставляется флаг у любого пользователя,
// который дошёл сюда не через Learning Path. Learning Path продолжает
// выставлять его сама (идемпотентно — .eq("completed_first_win", false)
// ниже просто ничего не найдёт у уже завершённых).
export async function maybeFirstWinMoments(supabase: SupabaseServerClient, userId: string): Promise<Moment[]> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("completed_first_win, preferred_notify_hour")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.completed_first_win) return [];

  await supabase.from("profiles").update({ completed_first_win: true }).eq("id", userId);

  if (profile.preferred_notify_hour !== null) return [];
  return [{ kind: "notify_ask", id: `notify-ask-${userId}` }];
}
