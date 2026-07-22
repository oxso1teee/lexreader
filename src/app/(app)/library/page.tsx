import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import TextCard from "./text-card";

export default async function LibraryPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: texts }, { data: progressRows }] = await Promise.all([
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
  ]);

  const progressByTextId = new Map(
    (progressRows ?? []).map((p) => [p.text_id, { percentRead: p.percent_read, lastReadAt: p.last_read_at }]),
  );

  const rows = (texts ?? []) as TextRow[];
  const own = rows.filter((t) => t.owner_id !== null);
  const system = rows.filter((t) => t.owner_id === null);

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <h1 className="mb-4 text-xl font-semibold">Библиотека</h1>

        <Section
          title="Мои тексты"
          texts={own}
          empty="Пока пусто — добавь свой первый текст."
          canDelete
          progressByTextId={progressByTextId}
        />
        {system.length > 0 && (
          <Section
            title="Библиотека приложения"
            texts={system}
            empty=""
            canDelete={false}
            progressByTextId={progressByTextId}
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
}: {
  title: string;
  texts: TextRow[];
  empty: string;
  canDelete: boolean;
  progressByTextId: Map<string, { percentRead: number; lastReadAt: string | null }>;
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
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
