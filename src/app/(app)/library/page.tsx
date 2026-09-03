import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import LibraryBrowser from "./library-browser";
import { materialsCountLabel, type LibraryItem } from "./library-item";

// Library mockup alignment — заголовок "Библиотека" на Playfair Display
// italic, тем же принципом, что уже применён в /read/[textId] (см.
// --font-reading в src/app/read/[textId]/page.tsx): scoped-загрузка прямо
// здесь, не через общий --font-serif/--font-playfair (тот подключён
// только внутри landing-page.tsx, вне области видимости на /library —
// PR #75, который добавлял его в корневой layout.tsx, ещё не смержен, и
// его правка layout.tsx всё равно вне заявленного для этой задачи списка
// файлов). page-header.tsx тоже не в списке файлов этой задачи — заголовок
// собран прямо здесь, а не через правку общего компонента.
const playfairDisplay = Playfair_Display({
  variable: "--font-library-serif",
  subsets: ["latin", "cyrillic"],
});

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
    <div className={`${playfairDisplay.variable} relative flex flex-1 flex-col`}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-5 py-6">
        {/* Library mockup alignment — референс: заголовок (Playfair italic,
            ~19px) слева, круглая иконка поиска справа. "+Добавить материал"
            и строка с числом материалов — существующая функциональность,
            не в референсе явно, но и не убрана: описание количества
            осталось отдельной строкой ниже, кнопка — рядом с иконкой
            поиска (на мобильном была скрыта и раньше, sm:flex, там
            остаётся только floating-FAB внизу, как и было). Иконка поиска
            ведёт на #library-search (реальный id инпута в
            library-browser.tsx, тот не тронут) — обычная HTML-навигация
            по якорю, без нового client-side состояния. */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-[family-name:var(--font-library-serif)] text-[19px] font-bold italic">Библиотека</h1>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="#library-search"
              aria-label="Поиск по библиотеке"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-card"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </a>
            <Link
              href="/library/new"
              className="focus-ring hidden min-h-11 items-center justify-center rounded-full bg-[var(--color-forest)] px-5 text-sm font-bold text-white sm:flex"
            >
              ＋ Добавить материал
            </Link>
          </div>
        </div>
        {items.length > 0 && (
          <p className="text-body-sm -mt-2 text-[var(--text-secondary)]">
            {materialsCountLabel(items.length)} · всё, что ты читаешь и смотришь на изучаемом языке
          </p>
        )}
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

      {/* bottom-20 (80px) раньше клал нижний край FAB ровно на верхний
          край MobileBottomNav — измерено живьём (getBoundingClientRect):
          новый плавающий tabbar (PR #76) стоит на bottom-4 (16px) и имеет
          высоту 64px, то есть его верхний край — ровно 80px от низа
          экрана, а FAB's bottom-20 = те же 80px — нулевой зазор, визуально
          выглядит как наложение (плюс тени обоих элементов). 96px = 80px
          (верх tabbar) + 16px зазора (тот же модуль, что уже даёт tabbar
          от края экрана) + env(safe-area-inset-bottom) — то же самое
          выражение, что уже держит tabbar над home-indicator на iOS (см.
          marginBottom в mobile-bottom-nav.tsx), чтобы зазор не схлопнулся
          на вырезных экранах. */}
      <Link
        href="/library/new"
        className="focus-ring fixed right-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest)] text-2xl text-white shadow-lg hover:bg-[var(--color-forest-deep)] sm:hidden"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
        aria-label="Добавить материал"
      >
        +
      </Link>
    </div>
  );
}
