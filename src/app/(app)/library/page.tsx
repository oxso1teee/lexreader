import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import { hashString, coverGradient, coverEmoji } from "@/lib/text-cover";
import TextCard from "./text-card";
import CollectionCard from "./collection-card";
import EmptyState from "@/components/empty-state";

export default async function LibraryPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: texts }, { data: progressRows }, { data: collectionRows }] = await Promise.all([
    supabase
      .from("texts")
      .select("*")
      .eq("language", profile.target_language)
      .or(`owner_id.eq.${profile.id},owner_id.is.null`)
      .order("created_at", { ascending: false }),
    supabase
      .from("text_progress")
      .select("text_id, percent_read, last_read_at")
      .eq("owner_id", profile.id),
    supabase
      .from("collections")
      .select("id, title")
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language),
  ]);

  const progressByTextId = new Map(
    (progressRows ?? []).map((p) => [p.text_id, { percentRead: p.percent_read, lastReadAt: p.last_read_at }]),
  );

  const rows = (texts ?? []) as TextRow[];
  const own = rows.filter((t) => t.owner_id !== null);
  const allSystem = rows.filter((t) => t.owner_id === null);

  // "Текст дня" — детерминированный выбор по дате, без крона: один и тот же
  // текст весь день, следующий день выбирает другой (docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 4.3).
  const today = new Date().toISOString().slice(0, 10);
  const featured =
    allSystem.length > 0 ? allSystem[hashString(today) % allSystem.length] : null;
  const system = featured ? allSystem.filter((t) => t.id !== featured.id) : allSystem;

  // Идея из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, п.1): тексты
  // одной коллекции показываем одной карточкой (агрегированный прогресс),
  // а не раскиданными по всему списку — раскрывается на отдельной странице.
  const ownWithoutCollection = own.filter((t) => !t.collection_id);
  const collectionsWithTexts = (collectionRows ?? [])
    .map((c) => {
      const textsInCollection = own.filter((t) => t.collection_id === c.id);
      if (textsInCollection.length === 0) return null;
      const percents = textsInCollection.map((t) => progressByTextId.get(t.id)?.percentRead ?? 0);
      const avgPercentRead = Math.round(percents.reduce((s, p) => s + p, 0) / percents.length);
      const lastReadAt = textsInCollection
        .map((t) => progressByTextId.get(t.id)?.lastReadAt)
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1);
      return { id: c.id, title: c.title, textCount: textsInCollection.length, avgPercentRead, lastReadAt: lastReadAt ?? null };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <h1 className="mb-4 text-xl font-semibold">Библиотека</h1>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Мои тексты
          </h2>
          {collectionsWithTexts.length === 0 && ownWithoutCollection.length === 0 ? (
            <EmptyState
              icon="📖✨"
              title="Здесь появятся твои тексты"
              body="Добавь первый — и начни читать."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {collectionsWithTexts.map((c) => (
                <CollectionCard
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  textCount={c.textCount}
                  avgPercentRead={c.avgPercentRead}
                  lastReadAt={c.lastReadAt}
                />
              ))}
              {ownWithoutCollection.map((t) => {
                const progress = progressByTextId.get(t.id);
                return (
                  <TextCard
                    key={t.id}
                    id={t.id}
                    title={t.title}
                    wordCount={t.word_count}
                    levelTag={t.level_tag}
                    canDelete
                    percentRead={progress?.percentRead ?? 0}
                    lastReadAt={progress?.lastReadAt ?? null}
                    youtubeVideoId={t.youtube_video_id}
                  />
                );
              })}
            </div>
          )}
        </section>

        {featured && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
              Текст дня
            </h2>
            <Link
              href={`/read/${featured.id}`}
              className="block rounded-xl p-4 text-white shadow-sm transition-opacity hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${coverGradient(featured.title)[0]}, ${coverGradient(featured.title)[1]})`,
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                {coverEmoji(featured.title)} {featured.level_tag ?? ""}
              </p>
              <p className="mt-1 text-lg font-semibold">{featured.title}</p>
              <p className="text-sm text-white/80">{featured.word_count ?? "?"} слов</p>
            </Link>
          </section>
        )}

        {system.length > 0 && (
          <Section
            title="Библиотека приложения"
            texts={system}
            empty=""
            canDelete={false}
            progressByTextId={progressByTextId}
            isSystem
          />
        )}
      </div>

      <Link
        href="/library/new"
        className="fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl text-white shadow-lg hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        aria-label="Добавить текст"
      >
        +
      </Link>
    </div>
  );
}

function Section({
  title,
  texts,
  empty,
  canDelete,
  progressByTextId,
  isSystem = false,
}: {
  title: string;
  texts: TextRow[];
  empty: string;
  canDelete: boolean;
  progressByTextId: Map<string, { percentRead: number; lastReadAt: string | null }>;
  isSystem?: boolean;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        {title}
      </h2>
      {texts.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {texts.map((t) => {
            const progress = progressByTextId.get(t.id);
            return (
              <TextCard
                key={t.id}
                id={t.id}
                title={t.title}
                wordCount={t.word_count}
                levelTag={t.level_tag}
                canDelete={canDelete}
                percentRead={progress?.percentRead ?? 0}
                lastReadAt={progress?.lastReadAt ?? null}
                youtubeVideoId={t.youtube_video_id}
                isSystem={isSystem}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
