import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/empty-state";
import LanguageTwinSubHeader from "../sub-header";
import RecommendationCard, { type RecommendationCardData } from "../recommendation-card";

export default async function LanguageTwinRecommendationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("language_recommendations")
    .select("*")
    .eq("user_id", profile.id)
    .eq("status", "pending")
    .order("priority", { ascending: true });

  const { data: past } = await supabase
    .from("language_recommendations")
    .select("*")
    .eq("user_id", profile.id)
    .in("status", ["completed", "dismissed"])
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinSubHeader title="Рекомендации" description="Каждая рекомендация связана с конкретным паттерном или пробелом" />

      {(pending ?? []).length === 0 ? (
        <EmptyState icon="🎯" title="Рекомендаций пока нет" body="Все текущие рекомендации выполнены — отличная работа, или пока недостаточно данных." />
      ) : (
        <div className="flex flex-col gap-3">
          {(pending as RecommendationCardData[]).map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      )}

      {(past ?? []).length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Завершено / скрыто</h2>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {(past ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-[var(--text-secondary)] line-through">{r.reason_key}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {r.status === "completed" ? "Выполнено" : "Скрыто"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
