import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function ProgressPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ count: totalWords }, { count: learnedWords }, { data: sessions }] = await Promise.all([
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("status", "known"),
    supabase
      .from("reading_sessions")
      .select("started_at, ended_at")
      .eq("owner_id", profile.id),
  ]);

  const totalMinutes = (sessions ?? []).reduce((sum, s) => {
    if (!s.started_at || !s.ended_at) return sum;
    const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
    return sum + Math.max(0, Math.round(ms / 60_000));
  }, 0);

  const stats = [
    { label: "Стрик", value: `${profile.streak_current} 🔥` },
    { label: "Лучший стрик", value: `${profile.streak_longest}` },
    { label: "Слов сохранено", value: `${totalWords ?? 0}` },
    { label: "Слов выучено", value: `${learnedWords ?? 0}` },
    { label: "Минут чтения", value: `${totalMinutes}` },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
      <h1 className="mb-4 text-xl font-semibold">Прогресс</h1>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-black/10 px-4 py-4 dark:border-white/15"
          >
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-black/50 dark:text-white/50">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
