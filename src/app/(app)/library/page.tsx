import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";

export default async function LibraryPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: texts } = await supabase
    .from("texts")
    .select("*")
    .eq("language", profile.target_language)
    .or(`owner_id.eq.${profile.id},owner_id.is.null`)
    .order("created_at", { ascending: false });

  const rows = (texts ?? []) as TextRow[];
  const own = rows.filter((t) => t.owner_id !== null);
  const system = rows.filter((t) => t.owner_id === null);

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <h1 className="mb-4 text-xl font-semibold">Библиотека</h1>

        <Section title="Мои тексты" texts={own} empty="Пока пусто — добавь свой первый текст." />
        {system.length > 0 && (
          <Section title="Библиотека приложения" texts={system} empty="" />
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

function Section({ title, texts, empty }: { title: string; texts: TextRow[]; empty: string }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        {title}
      </h2>
      {texts.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {texts.map((t) => (
            <Link
              key={t.id}
              href={`/read/${t.id}`}
              className="rounded-lg border border-black/10 px-4 py-3 transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-black/50 dark:text-white/50">
                {t.word_count ?? "?"} слов
                {t.level_tag ? ` · ${t.level_tag}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
