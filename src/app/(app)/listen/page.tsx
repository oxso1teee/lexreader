import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/product/page-header";
import EmptyState from "@/components/empty-state";

// Gamified redesign — Listen Lounge: listening was already a real Reader
// mode (browser TTS, reader-listening.tsx), just never a distinct entry
// point of its own. This lists the SAME real texts Library already shows
// and deep-links each one straight into listening mode
// (/read/[id]?mode=listening -- see the optional searchParams read added
// to reader.tsx), instead of building a second reading system.
export default async function ListenLoungePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: texts } = await supabase
    .from("texts")
    .select("id, title, word_count, level_tag")
    .eq("language", profile.target_language)
    .or(`owner_id.eq.${profile.id},owner_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Listen Lounge" />
      <p className="text-body-sm text-[var(--text-secondary)]">
        Слушай текст вслух (озвучка браузера) и следи по строкам.
      </p>

      {!texts || texts.length === 0 ? (
        <EmptyState icon="🎧" title="Пока нет текстов" body="Добавь текст в Библиотеке, и он появится здесь." />
      ) : (
        <div className="flex flex-col gap-2">
          {texts.map((t) => (
            <Link
              key={t.id}
              href={`/read/${t.id}?mode=listening`}
              className="focus-ring flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] p-4 shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div>
                <p className="text-body font-semibold">{t.title}</p>
                <p className="text-caption text-[var(--text-secondary)]">
                  {t.level_tag ? `${t.level_tag} · ` : ""}
                  {t.word_count ?? "?"} слов
                </p>
              </div>
              <span aria-hidden="true">🎧</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
