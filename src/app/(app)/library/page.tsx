import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import PageHeader from "@/components/product/page-header";
import LibraryBrowser from "./library-browser";
import { materialsCountLabel, type LibraryItem } from "./library-item";

export default async function LibraryPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: texts }, { data: progressRows }, { data: collectionRows }, { data: vocabRows }, { data: cardRows }] =
    await Promise.all([
      supabase
        .from("texts")
        .select("*")
        .eq("language", profile.target_language)
        .or(`owner_id.eq.${profile.id},owner_id.is.null`)
        .order("created_at", { ascending: false }),
      supabase.from("text_progress").select("text_id, percent_read, last_read_at").eq("owner_id", profile.id),
      supabase
        .from("collections")
        .select("id, title")
        .eq("owner_id", profile.id)
        .eq("language", profile.target_language),
      // M3 Slice 3: "сохранённые слова/фразы" per material — real counts,
      // grouped client-side rather than N+1 queries per card.
      supabase
        .from("vocabulary_items")
        .select("source_text_id")
        .eq("owner_id", profile.id)
        .eq("language", profile.target_language)
        .not("source_text_id", "is", null),
      supabase
        .from("flashcards")
        .select("source_text_id")
        .eq("owner_id", profile.id)
        .eq("language", profile.target_language)
        .not("source_text_id", "is", null),
    ]);

  const progressByTextId = new Map(
    (progressRows ?? []).map((p) => [p.text_id, { percentRead: p.percent_read, lastReadAt: p.last_read_at }]),
  );
  const wordCountByTextId = new Map<string, number>();
  for (const row of vocabRows ?? []) {
    if (!row.source_text_id) continue;
    wordCountByTextId.set(row.source_text_id, (wordCountByTextId.get(row.source_text_id) ?? 0) + 1);
  }
  const phraseCountByTextId = new Map<string, number>();
  for (const row of cardRows ?? []) {
    if (!row.source_text_id) continue;
    phraseCountByTextId.set(row.source_text_id, (phraseCountByTextId.get(row.source_text_id) ?? 0) + 1);
  }

  const rows = (texts ?? []) as TextRow[];
  const ownWithoutCollection = rows.filter((t) => t.owner_id !== null && !t.collection_id);
  const standaloneSystem = rows.filter((t) => t.owner_id === null && !t.collection_id);

  const collectionItems: LibraryItem[] = (collectionRows ?? [])
    .map((c) => {
      const textsInCollection = rows.filter((t) => t.collection_id === c.id);
      if (textsInCollection.length === 0) return null;
      const percents = textsInCollection.map((t) => progressByTextId.get(t.id)?.percentRead ?? 0);
      const avgPercentRead = Math.round(percents.reduce((s, p) => s + p, 0) / percents.length);
      const lastReadAt = textsInCollection
        .map((t) => progressByTextId.get(t.id)?.lastReadAt)
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1);
      const firstText = [...textsInCollection].sort((a, b) => (a.collection_order ?? 0) - (b.collection_order ?? 0))[0];
      const savedWordsCount = textsInCollection.reduce((s, t) => s + (wordCountByTextId.get(t.id) ?? 0), 0);
      const savedPhrasesCount = textsInCollection.reduce((s, t) => s + (phraseCountByTextId.get(t.id) ?? 0), 0);
      const item: LibraryItem = {
        id: `collection:${c.id}`,
        kind: "collection",
        title: c.title,
        href: `/read/${firstText.id}`,
        language: profile.target_language,
        levelTag: null,
        youtubeVideoId: null,
        isSystem: false,
        canDelete: false,
        percentRead: avgPercentRead,
        lastReadAt: lastReadAt ?? null,
        savedWordsCount,
        savedPhrasesCount,
        partCount: textsInCollection.length,
      };
      return item;
    })
    .filter((c): c is LibraryItem => c !== null);

  function toItem(t: TextRow): LibraryItem {
    const progress = progressByTextId.get(t.id);
    return {
      id: t.id,
      kind: "text",
      title: t.title,
      href: t.youtube_video_id ? `/watch/${t.id}` : `/read/${t.id}`,
      language: t.language,
      levelTag: t.level_tag,
      youtubeVideoId: t.youtube_video_id,
      isSystem: t.owner_id === null,
      canDelete: t.owner_id !== null,
      percentRead: progress?.percentRead ?? 0,
      lastReadAt: progress?.lastReadAt ?? null,
      savedWordsCount: wordCountByTextId.get(t.id) ?? 0,
      savedPhrasesCount: phraseCountByTextId.get(t.id) ?? 0,
      partCount: null,
    };
  }

  const items: LibraryItem[] = [
    ...collectionItems,
    ...ownWithoutCollection.map(toItem),
    ...standaloneSystem.map(toItem),
  ];

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-5 py-6">
        <PageHeader
          title="Библиотека"
          description={
            items.length > 0
              ? `${materialsCountLabel(items.length)} · всё, что ты читаешь и смотришь на изучаемом языке`
              : undefined
          }
          action={
            <Link
              href="/library/new"
              className="focus-ring hidden min-h-11 items-center justify-center rounded-full bg-[var(--color-forest)] px-5 text-sm font-bold text-white sm:flex"
            >
              ＋ Добавить материал
            </Link>
          }
        />
        <Link
          href="/learning-paths"
          className="focus-ring flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-sm"
        >
          <div>
            <p className="text-body-sm font-semibold">Пути обучения</p>
            <p className="text-xs text-[var(--text-secondary)]">Структурированные курсы: A2→B1, B1→B2, Everyday, IT</p>
          </div>
          <span className="shrink-0 text-body-sm font-semibold text-[var(--color-forest-text)]">Открыть →</span>
        </Link>

        <LibraryBrowser items={items} />
      </div>

      <Link
        href="/library/new"
        className="focus-ring fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest)] text-2xl text-white shadow-lg hover:bg-[var(--color-forest-deep)] sm:hidden"
        aria-label="Добавить материал"
      >
        +
      </Link>
    </div>
  );
}
