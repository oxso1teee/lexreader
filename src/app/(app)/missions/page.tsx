import Link from "next/link";
import { Target } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getOrGenerateActiveMissions, getStartedMissionProgress } from "@/lib/missions/persist";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import MissionCard from "@/components/product/missions/mission-card";
import MissionsSubHeader from "./sub-header";

// Missions has no nav entry of its own — this is the "see everything active"
// page reached from Today's compact list, mirroring how
// /language-twin/patterns works relative to /language-twin.
export default async function MissionsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [missions, startedProgress] = await Promise.all([
    getOrGenerateActiveMissions(supabase, profile.id, profile.target_language),
    getStartedMissionProgress(supabase, profile.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <MissionsSubHeader
        title="Миссии"
        description="Конкретный следующий шаг, собранный из твоего профиля «Мой английский» — не случайное упражнение."
        backHref="/home"
        backLabel="На главную"
      />

      {/* Missions mockup alignment — hero only when there's something honest
          to show: a mission genuinely in progress (status="started") AND a
          real mission_attempts row to compute current_step/step_count from
          (getStartedMissionProgress returns null otherwise, no
          default/zero/fake state ever rendered here). Title is the real
          mission.title, not invented "Миссия дня" copy attached to someone
          else's mission. */}
      {startedProgress && (
        <Link
          href={`/missions/${startedProgress.mission.id}`}
          className="focus-ring block rounded-[20px] px-[17px] py-4 text-white"
          style={{ background: "linear-gradient(150deg, var(--color-forest), var(--color-forest-light))" }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-wide opacity-85">Миссия дня</p>
          <p className="mt-1 mb-2.5 font-display text-[17px] font-bold">
            {startedProgress.mission.title}
          </p>
          <div
            role="progressbar"
            aria-valuenow={startedProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Прогресс миссии: ${startedProgress.percent}%`}
            className="h-[7px] rounded-full bg-white/[0.28]"
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${startedProgress.percent}%` }} />
          </div>
        </Link>
      )}

      {missions.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Пока нет активных миссий"
          body="Миссии появляются, когда в профиле «Мой английский» накопится достаточно данных — почитай что-нибудь, повтори карточки в Мозге или пройди мини-диагностику."
          action={
            <ButtonLink href="/language-twin" variant="leaf" className="mt-2">
              Открыть «Мой английский»
            </ButtonLink>
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
        className="focus-ring self-start text-sm font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
      >
        История миссий →
      </Link>
    </div>
  );
}
