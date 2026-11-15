import type { SupabaseServerClient } from "@/lib/supabase/server";

// Два счётчика сохранённых слов для главного экрана: чек-лист «Первые шаги»
// (сколько слов уже сохранено) и итоги дня (сколько добавлено сегодня).
// Читает vocabulary_items только текущего пользователя — RLS-политика
// "vocabulary_items: owner full access" (owner_id = auth.uid()) плюс явный
// фильтр по owner_id; ничего не пишет и новых таблиц не требует.
export async function countSavedWords(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<number> {
  const { count } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("language", language);
  return count ?? 0;
}

export async function countSavedWordsSince(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("language", language)
    .gte("created_at", sinceIso);
  return count ?? 0;
}
