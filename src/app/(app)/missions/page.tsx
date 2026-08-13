import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getOrGenerateActiveMissions } from "@/lib/missions/persist";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/empty-state";
import MissionCard from "@/components/product/missions/mission-card";
import MissionsSubHeader from "./sub-header";

// Missions has no nav entry of its own — this is the "see everything active"
// page reached from Today's compact list, mirroring how
// /language-twin/patterns works relative to /language-twin.
export default async function MissionsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const missions = await getOrGenerateActiveMissions(supabase, profile.id, profile.target_language);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <MissionsSubHeader
        title="Миссии"
        description="Конкретный следующий шаг, собранный из твоего профиля «Мой английский» — не случайное упражнение."
        backHref="/home"
        backLabel="На главную"
      />

      {missions.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Пока нет активных миссий"
          body="Миссии появляются, когда в профиле «Мой английский» накопится достаточно данных — почитай что-нибудь, повтори карточки в Мозге или пройди мини-диагностику."
          action={
            <Link
              href="/language-twin"
              className="focus-ring mt-2 rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black"
            >
              Открыть «Мой английский»
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      )}

      <Link
        href="/missions/history"
        className="focus-ring self-start text-sm font-medium text-[var(--color-caramel-text)] underline-offset-2 hover:underline"
      >
        История миссий →
      </Link>
    </div>
  );
}
