"use client";

import Link from "next/link";
import { track } from "@/lib/posthog-client";
import { messages } from "@/lib/i18n";
import { categoryLabel } from "@/components/product/language-twin/badges";
import type { MissionRow, MissionType } from "@/lib/missions/types";

const t = messages.today.hero;

const GRAMMAR_RUNNER_TYPES = new Set<MissionType>(["grammar_pattern", "correction", "diagnostic_followup", "maintenance"]);

// Today v2 plan §4: honest headline from real fields — no invented sub-topic
// name (the mockup's "Present Continuous Sprint" names a tense we don't
// track as its own category, only the coarser "tense" bucket).
const TARGETED_HEADLINE: Partial<Record<MissionType, string>> = {
  vocab_activation: "Активация слов",
  review_recovery: "Повторение слов",
  phrase_activation: "Активация фраз",
};

function heroHeadline(mission: MissionRow): string {
  if (GRAMMAR_RUNNER_TYPES.has(mission.mission_type) && mission.skill_category) {
    return `Спринт: ${categoryLabel(mission.skill_category)}`;
  }
  return TARGETED_HEADLINE[mission.mission_type] ?? mission.title;
}

// The Today hero slot — one card, sourced from a real active mission. Same
// visual language as PrimaryActionCard (forest gradient, black CTA pill) so
// swapping between "here's your mission" and the plain review/reading
// fallback (home/page.tsx renders PrimaryActionCard directly when no mission
// exists) never feels like two different apps.
export default function HeroMissionCard({
  mission,
  reasonText,
}: {
  mission: MissionRow;
  reasonText: string | null;
}) {
  const isStarted = mission.status === "started";
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-forest to-forest-light p-5 text-white shadow-sm">
      <span className="text-label uppercase tracking-wide text-white/70">Твой следующий шаг</span>
      <div>
        <h2 className="text-h2">{heroHeadline(mission)}</h2>
        {reasonText && <p className="text-body-sm mt-1 text-white/85">{reasonText}</p>}
        <p className="text-body-sm mt-1 text-white/70">~{mission.estimated_minutes} мин</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/missions/${mission.id}`}
          onClick={() => track("today_primary_action_clicked", { action_type: "mission", destination: `/missions/${mission.id}` })}
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-black/85 px-5 text-center text-sm font-semibold text-white hover:bg-black/70"
        >
          {isStarted ? t.continueCta : t.startCta}
        </Link>
        <Link href="/missions" className="focus-ring text-sm font-medium text-white/85 underline-offset-2 hover:underline">
          {t.allMissionsLink}
        </Link>
      </div>
    </div>
  );
}
