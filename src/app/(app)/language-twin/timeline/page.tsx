import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/empty-state";
import LanguageTwinSubHeader from "../sub-header";
import { buildTimelineEntries } from "@/lib/language-twin/timeline";

export default async function LanguageTwinTimelinePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: patterns } = await supabase
    .from("language_error_patterns")
    .select("id, title, status, first_seen_at, last_seen_at")
    .eq("user_id", profile.id)
    .order("first_seen_at", { ascending: false })
    .limit(20);

  const { data: evidenceDays } = await supabase
    .from("language_evidence")
    .select("occurred_at, evidence_type")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(60);

  const entries = buildTimelineEntries(patterns ?? [], evidenceDays ?? []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinSubHeader title="История прогресса" description="Реальные обновления профиля, не витрина достижений" />
      {entries.length === 0 ? (
        <EmptyState icon="📈" title="История пока пуста" body="Как только накопится активность, здесь появятся реальные изменения профиля." />
      ) : (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <ol className="relative flex flex-col gap-4 border-l-2 border-[var(--border)] pl-4">
            {entries.slice(0, 30).map((e, i) => (
              <li key={i} className="relative">
                <span aria-hidden="true" className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-forest" />
                <p className="text-xs text-[var(--text-secondary)]">{e.date}</p>
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-[var(--text-secondary)]">{e.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
