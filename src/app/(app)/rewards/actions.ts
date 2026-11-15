"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateGoalChoice, type DailyGoalType } from "@/lib/goals/config";
import { syncGoalProgressFor } from "@/lib/goals/goal-sync-server";

export type SaveGoalResult = { ok: true; type: DailyGoalType; target: number } | { ok: false; error: string };

// Server actions — публичные POST-эндпоинты: тип и размер цели проверяются здесь
// заново по тем же пресетам, что показывает форма (клиенту не доверяем), а
// пользователь определяется из серверной сессии, не из аргументов.
export async function saveDailyGoalAction(type: unknown, target: unknown): Promise<SaveGoalResult> {
  const choice = validateGoalChoice(type, target);
  if (!choice.ok) return { ok: false, error: "Такой цели нет. Выбери один из вариантов." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };

  // Для XP размер по-прежнему хранится в daily_xp_goal (его же выбирает онбординг и
  // читают неделя/серия/моменты); для остальных — в daily_goal_target, а XP-цель
  // не трогаем: выбор пользователя из онбординга не перезаписывается.
  const patch =
    choice.type === "xp"
      ? { daily_goal_type: "xp", daily_goal_target: null, daily_xp_goal: choice.target }
      : { daily_goal_type: choice.type, daily_goal_target: choice.target };
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: "Не удалось сохранить цель. Попробуй ещё раз." };

  // Если сегодня цель уже набрана по НОВОМУ типу (например, 3 урока уже пройдено, а выбрана
  // цель «2 урока»), день сразу отмечается выполненным — по тем же фактам, что и прогресс.
  // Момент «цель выполнена» тут не показываем: пользователь просто сменил цель.
  await syncGoalProgressFor(supabase, user.id, { includeXp: true });

  revalidatePath("/home");
  revalidatePath("/rewards");
  return { ok: true, type: choice.type, target: choice.target };
}
