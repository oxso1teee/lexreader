import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import FirstWinFlow from "./first-win-flow";

export default async function FirstWinPage() {
  const profile = await requireProfile();
  // Уже проходил — не показываем туториал повторно при прямом заходе по ссылке.
  if (profile.completed_first_win) redirect("/home");

  const supabase = await createClient();
  const { data: texts } = await supabase
    .from("texts")
    .select("id, title, body, word_count, level_tag")
    .is("owner_id", null)
    .eq("language", profile.target_language)
    .order("word_count", { ascending: true })
    .limit(4);

  // Английский — единственный язык с готовым системным контентом на сейчас
  // (раздел 4 промта); для остальных языков просто пропускаем шаг "выбери
  // текст" и сразу отправляем на Главную — лучше пустой онбординг, чем
  // сломанный шаг без единого текста на выбор.
  if (!texts || texts.length === 0) redirect("/home");

  return (
    <FirstWinFlow
      texts={texts.map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        wordCount: t.word_count,
        levelTag: t.level_tag,
      }))}
    />
  );
}
