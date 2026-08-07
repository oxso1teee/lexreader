// Built from language_evidence + language_error_patterns timestamps — there
// is no dedicated timeline/log table (plan doc §17: no history table for
// reading-side transitions exists yet). This is an honest reconstruction
// from what we do log, not a purpose-built audit trail. Pure/no I/O so the
// full Timeline page and the Overview's compact "Последние изменения
// профиля" widget can share one implementation instead of drifting apart.
export interface TimelineEntry {
  date: string;
  title: string;
  desc: string;
  sortKey: string;
}

export function buildTimelineEntries(
  patterns: { title: string; status: string; first_seen_at: string }[],
  evidenceDays: { occurred_at: string }[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const p of patterns) {
    entries.push({
      sortKey: p.first_seen_at,
      date: new Date(p.first_seen_at).toLocaleDateString("ru-RU"),
      title: p.status === "resolved" ? `Паттерн закрыт: ${p.title}` : `Замечен новый паттерн`,
      desc: p.title,
    });
  }

  const byDay = new Map<string, number>();
  for (const e of evidenceDays) {
    const day = new Date(e.occurred_at).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  for (const [day, count] of byDay) {
    if (count < 3) continue; // only surface genuinely active days, not noise
    entries.push({
      sortKey: `${day}T00:00:00Z`,
      date: new Date(day).toLocaleDateString("ru-RU"),
      title: "Активный день",
      desc: `${count} новых записей за день`,
    });
  }

  entries.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
  return entries;
}
