import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/product/page-header";
import EmptyState from "@/components/empty-state";
import LanguageTwinNav from "../language-twin-nav";

// Built from language_evidence + language_error_patterns timestamps — there
// is no dedicated timeline/log table (plan doc §17: no history table for
// reading-side transitions exists yet). This is an honest reconstruction
// from what we do log, not a purpose-built audit trail.
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

  type TimelineEntry = { date: string; title: string; desc: string; sortKey: string };
  const entries: TimelineEntry[] = [];

  for (const p of patterns ?? []) {
    entries.push({
      sortKey: p.first_seen_at,
      date: new Date(p.first_seen_at).toLocaleDateString("ru-RU"),
      title: p.status === "resolved" ? `Паттерн закрыт: ${p.title}` : `Замечен новый паттерн`,
      desc: p.title,
    });
  }

  const byDay = new Map<string, number>();
  for (const e of evidenceDays ?? []) {
    const day = new Date(e.occurred_at).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  for (const [day, count] of byDay) {
    if (count < 3) continue; // only surface genuinely active days, not noise
    entries.push({
      sortKey: `${day}T00:00:00Z`,
      date: new Date(day).toLocaleDateString("ru-RU"),
      title: "Активный день",
      desc: `${count} новых свидетельств за день`,
    });
  }

  entries.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="История изменений" description="Реальные обновления профиля, не витрина достижений" />
      <LanguageTwinNav current="/language-twin/timeline" />
      {entries.length === 0 ? (
        <EmptyState icon="📈" title="История пока пуста" body="Как только накопится активность, здесь появятся реальные изменения профиля." />
      ) : (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <ol className="relative flex flex-col gap-4 border-l-2 border-[var(--border)] pl-4">
            {entries.slice(0, 30).map((e, i) => (
              <li key={i} className="relative">
                <span aria-hidden="true" className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-caramel" />
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
