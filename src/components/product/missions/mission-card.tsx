import Link from "next/link";
import {
  BookMarked,
  BookOpenText,
  Compass,
  MessageSquareText,
  PenLine,
  RefreshCw,
  RotateCcw,
  SpellCheck2,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { missionTypeLabel, difficultyLabel, MissionPriorityDot } from "./badges";
import type { MissionRow, MissionStatus, MissionType } from "@/lib/missions/types";

const STATUS_BADGE: Partial<Record<MissionStatus, { label: string; className: string }>> = {
  started: { label: "В процессе", className: "bg-[var(--color-info)]/15 text-[var(--color-info-text)]" },
  completed: { label: "✓ Завершена", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
  dismissed: { label: "Отклонена", className: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10" },
  expired: { label: "Истекла", className: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10" },
};

// Missions mockup alignment — one icon per mission_type (9 values,
// src/lib/missions/types.ts), rendered inside the forest-tint square below.
// Not a decorative choice each has a real semantic tie to what the mission
// type actually is: SpellCheck2=grammar, BookMarked=new vocab, RotateCcw=
// recovering forgotten words, BookOpenText=reading, MessageSquareText=
// phrases, PenLine=correcting a specific error, Stethoscope=diagnostic
// follow-up, RefreshCw=maintenance, Compass=onboarding/orientation.
const MISSION_ICON: Record<MissionType, LucideIcon> = {
  grammar_pattern: SpellCheck2,
  vocab_activation: BookMarked,
  review_recovery: RotateCcw,
  reading: BookOpenText,
  phrase_activation: MessageSquareText,
  correction: PenLine,
  diagnostic_followup: Stethoscope,
  maintenance: RefreshCw,
  onboarding: Compass,
};

// Missions mockup alignment — flat card (badges row + title + reason +
// separate meta line) -> compact row: type icon in a forest-tint square on
// the left, title+meta stacked on the right, priority dot + status pill on
// the far right. Still used only by /missions and /missions/history
// (mission-screen.tsx, the detail page, keeps its own MissionTypeBadge/
// MissionPriorityBadge rendering directly — untouched, out of scope here).
//
// reason_key (previously its own line under the title) is dropped from
// this compact row — the reference's meta line has room for exactly one
// line of text, and "~N мин · Сложность · Шагов: M" is the more
// actionable, decision-relevant line of the two for a scan-and-tap list
// (the WHY is still one tap away on the mission's own detail page). Never
// added the reference's "1/2"/"4/10" fraction — no honest per-mission
// source for it (see the task's own note); step_count alone stays, exactly
// as before.
export default function MissionCard({ mission }: { mission: MissionRow }) {
  const statusBadge = STATUS_BADGE[mission.status];
  const Icon = MISSION_ICON[mission.mission_type];
  return (
    <Link
      href={`/missions/${mission.id}`}
      className="focus-ring flex items-center gap-2.5 rounded-[14px] border border-[var(--border)] bg-card px-[13px] py-[11px] transition-shadow hover:shadow-md"
    >
      {/* aria-hidden: type is still conveyed to assistive tech via the
          sr-only text below, not lost, just moved off the visible icon. */}
      <span
        aria-hidden="true"
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-forest-tint)]"
      >
        <Icon className="h-[15px] w-[15px] text-[var(--color-forest-text)]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold">{mission.title}</p>
        <p className="truncate text-[10px] text-[var(--text-secondary)]">
          <span className="sr-only">{missionTypeLabel(mission.mission_type)} · </span>
          ~{mission.estimated_minutes} мин · {difficultyLabel(mission.difficulty)} · Шагов: {mission.step_count}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <MissionPriorityDot priority={mission.priority} />
        {statusBadge && (
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        )}
      </div>
    </Link>
  );
}
