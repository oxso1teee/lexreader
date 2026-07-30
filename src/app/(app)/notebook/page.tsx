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
    .select("id, headword, translation, status, photo_url, is_favorite, texts(title)")
    .eq("owner_id", profile.id)
    .eq("language", profile.target_language)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const [{ data: items }, { count: totalCount }, { data: defaultDeck }] = await Promise.all([
    query,
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language),
    // Слова из чтения и Мозг слиты в один раздел (0028_link_reading_words_to_brain.sql)
    // — "Учить" ведёт на настоящее интервальное повторение колоды по умолчанию.
    supabase
      .from("decks")
      .select("id")
      .eq("owner_id", profile.id)
      .eq("is_default", true)
      .eq("language", profile.target_language)
      .maybeSingle(),
  ]);

  let reviewDueCount = 0;
  if (defaultDeck) {
    const { count } = await supabase
      .from("srs_state")
      .select("flashcard_id, flashcards!inner(deck_id)", { count: "exact", head: true })
      .eq("flashcards.deck_id", defaultDeck.id)
      .lte("due_at", new Date().toISOString());
    reviewDueCount = count ?? 0;
  }

  // Найдено при повторном аудите RLS: бакет word-photos был публично
  // читаемым (любой мог перечислить и скачать чужие фото) — теперь
  // приватный, photo_url в базе хранит путь, а не URL, отдаём на клиент
  // подписанный URL с ограниченным сроком жизни.
  const itemsWithPhotos = items ?? [];
  const signedUrls = new Map<string, string>();
  await Promise.all(
    itemsWithPhotos
      .filter((item) => item.photo_url)
      .map(async (item) => {
        const { data } = await supabase.storage
          .from("word-photos")
          .createSignedUrl(item.photo_url!, 3600);
        if (data?.signedUrl) signedUrls.set(item.id, data.signedUrl);
      }),
  );

  return (
    <NotebookClient
      ownerId={profile.id}
      status={status ?? ""}
      targetLanguage={languageName(profile.target_language)}
      sourceLang={profile.target_language}
      nativeLang={profile.native_language}
      items={itemsWithPhotos.map((item) => ({
        id: item.id,
        headword: item.headword,
        translation: item.translation,
        status: item.status,
        photo_url: signedUrls.get(item.id) ?? null,
        is_favorite: item.is_favorite,
        sourceTitle: (item.texts as unknown as { title: string } | null)?.title ?? null,
      }))}
      totalCount={totalCount ?? 0}
      reviewDeckId={defaultDeck?.id ?? null}
      reviewDueCount={reviewDueCount}
    />
  );
}
