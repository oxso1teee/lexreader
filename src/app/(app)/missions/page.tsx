import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { requireProfile } from "@/lib/auth";
import { getOrGenerateActiveMissions, getStartedMissionProgress } from "@/lib/missions/persist";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/empty-state";
import MissionCard from "@/components/product/missions/mission-card";
import MissionsSubHeader from "./sub-header";

// Missions mockup alignment — scoped Playfair Display for the hero banner's
// title, same pattern as library/page.tsx (--font-library-serif) and
// read/[textId]/page.tsx (--font-reading): local next/font/google load
// right here, not the shared --font-serif (only wired up in
// landing-page.tsx).
const playfairDisplay = Playfair_Display({
  variable: "--font-missions-hero",
  subsets: ["latin", "cyrillic"],
});

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
          className={`${playfairDisplay.variable} focus-ring block rounded-[20px] px-[17px] py-4 text-white`}
          style={{ background: "linear-gradient(150deg, var(--color-forest), var(--color-forest-light))" }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-wide opacity-85">Миссия дня</p>
          <p className="mt-1 mb-2.5 font-[family-name:var(--font-missions-hero)] text-[17px] font-bold italic">
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
          icon="🎯"
          title="Пока нет активных миссий"
          body="Миссии появляются, когда в профиле «Мой английский» накопится достаточно данных — почитай что-нибудь, повтори карточки в Мозге или пройди мини-диагностику."
          action={
            <Link
              href="/language-twin"
              className="focus-ring mt-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
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
        className="focus-ring self-start text-sm font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
      >
        История миссий →
      </Link>
    </div>
  );
}
