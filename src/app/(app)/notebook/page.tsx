import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { languageName } from "@/lib/languages";
import NotebookClient from "./notebook-client";

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  // P0-АУДИТ 3.9: Тетрадь фильтруется по текущему изучаемому языку — иначе
  // слова разных языков (после смены языка в Настройках) видны вперемешку.
  let query = supabase
    .from("vocabulary_items")
    .select("id, headword, translation, status, photo_url, texts(title)")
    .eq("owner_id", profile.id)
    .eq("language", profile.target_language)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const [{ data: items }, { data: allWords }] = await Promise.all([
    query,
    supabase
      .from("vocabulary_items")
      .select("id, headword, translation")
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <NotebookClient
      ownerId={profile.id}
      status={status ?? ""}
      targetLanguage={languageName(profile.target_language)}
      sourceLang={profile.target_language}
      nativeLang={profile.native_language}
      items={(items ?? []).map((item) => ({
        id: item.id,
        headword: item.headword,
        translation: item.translation,
        status: item.status,
        photo_url: item.photo_url,
        sourceTitle: (item.texts as unknown as { title: string } | null)?.title ?? null,
      }))}
      allWords={allWords ?? []}
    />
  );
}
