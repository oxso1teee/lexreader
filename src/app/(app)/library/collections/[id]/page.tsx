import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import TextCard from "../../text-card";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("id, title")
    .eq("id", id)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!collection) notFound();

  const [{ data: texts }, { data: progressRows }] = await Promise.all([
    supabase
      .from("texts")
      .select("*")
      .eq("collection_id", id)
      .order("collection_order", { ascending: true }),
    supabase
      .from("text_progress")
      .select("text_id, percent_read, last_read_at")
      .eq("owner_id", profile.id),
  ]);

  const progressByTextId = new Map(
    (progressRows ?? []).map((p) => [p.text_id, { percentRead: p.percent_read, lastReadAt: p.last_read_at }]),
  );

  const rows = (texts ?? []) as TextRow[];

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
      <Link href="/library" className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
        ← Библиотека
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">📚 {collection.title}</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">В этой коллекции пока нет текстов.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((t, index) => {
            const progress = progressByTextId.get(t.id);
            return (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-sm text-black/30 dark:text-white/30">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <TextCard
                    id={t.id}
                    title={t.title}
                    wordCount={t.word_count}
                    levelTag={t.level_tag}
                    canDelete
                    percentRead={progress?.percentRead ?? 0}
                    lastReadAt={progress?.lastReadAt ?? null}
                    youtubeVideoId={t.youtube_video_id}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
