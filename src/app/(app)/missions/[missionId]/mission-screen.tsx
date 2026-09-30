"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startMissionAction, dismissMissionAction, type CompleteMissionResult } from "../actions";
import { track } from "@/lib/posthog-client";
import { reasonLabel } from "@/components/product/language-twin/badges";
import { StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";
import { MissionPriorityBadge, MissionTypeBadge, difficultyLabel } from "@/components/product/missions/badges";
import { GRAMMAR_RUNNER_MISSION_TYPES, TARGETED_MISSION_TYPES, type GrammarMissionPayload, type TargetedMissionPayload } from "@/lib/missions/payload";
import type { MissionAttemptRow, MissionRow, MissionType } from "@/lib/missions/types";
import type { PatternRow } from "@/lib/language-twin/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import GrammarRunner from "./grammar-runner";

const GRAMMAR_TYPES = new Set<MissionType>(GRAMMAR_RUNNER_MISSION_TYPES);
const TARGETED_TYPES = new Set<MissionType>(TARGETED_MISSION_TYPES);

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "меньше минуты";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "меньше минуты";
  return `${minutes} мин`;
}

// M3 Slice 10 (task #279): a vocab_activation mission exists to push words toward
// learning_state='active' — but only Type (or Context Gap, tagged practice_mode:'type') counts
// as strong-recall evidence toward that (state-engine.ts). The review flow's default Cards mode
// is self-graded, weak evidence — completing the whole mission there would never actually
// activate anything. Type mode always has playable content for any flashcard (unlike Context
// Gap, which needs a saved context sentence), so it's the safe, universal choice here.
function targetedReviewUrl(missionType: MissionType, wordIds: string[], missionId: string): string {
  const mode = missionType === "vocab_activation" ? "&mode=type" : "";
  return `/brain/all/review?wordIds=${wordIds.join(",")}&missionId=${missionId}${mode}`;
}

export default function MissionScreen({
  mission: initialMission,
  initialAttempt,
  initialPattern,
}: {
  mission: MissionRow;
  initialAttempt: MissionAttemptRow | null;
  initialPattern: Pick<PatternRow, "title" | "category" | "status" | "trend"> | null;
}) {
  const router = useRouter();
  const [mission, setMission] = useState(initialMission);
  const [attempt, setAttempt] = useState(initialAttempt);
  const [pattern, setPattern] = useState(initialPattern);
  const [isStarting, setIsStarting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (mission.status === "started") track("mission_resumed", { mission_type: mission.mission_type });
    else if (mission.status === "available") track("mission_opened", { mission_type: mission.mission_type });
    else if (mission.status === "completed") track("mission_result_viewed", { mission_type: mission.mission_type });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    setIsStarting(true);
    track("mission_started", { mission_type: mission.mission_type });
    const result = await startMissionAction(mission.id);
    setIsStarting(false);
    if (!result) return;
    setMission(result.mission);
    setAttempt(result.attempt);

    if (TARGETED_TYPES.has(result.mission.mission_type)) {
      const payload = result.mission.payload_json as unknown as TargetedMissionPayload;
      const wordIds = payload.wordIds ?? [];
      router.push(targetedReviewUrl(result.mission.mission_type, wordIds, result.mission.id));
    }
  }

  function handleContinueTargeted() {
    const payload = mission.payload_json as unknown as TargetedMissionPayload;
    const wordIds = payload.wordIds ?? [];
    router.push(targetedReviewUrl(mission.mission_type, wordIds, mission.id));
  }

  async function handleDismiss() {
    setIsDismissing(true);
    await dismissMissionAction(mission.id);
    track("mission_dismissed", { mission_type: mission.mission_type });
    router.push("/missions");
  }

  function handleGrammarComplete(result: CompleteMissionResult | null) {
    if (!result) return;
    setAttempt(result.attempt);
    setMission((m) => ({ ...m, status: "completed", completed_at: result.attempt.completed_at }));
    if (result.languageTwinUpdate) {
      setPattern({
        title: result.languageTwinUpdate.patternTitle,
        category: result.languageTwinUpdate.category as PatternRow["category"],
        status: result.languageTwinUpdate.status as PatternRow["status"],
        trend: result.languageTwinUpdate.trend as PatternRow["trend"],
      });
    }
  }

  const metaRow = (
    <div className="flex flex-wrap items-center gap-2">
      <MissionTypeBadge type={mission.mission_type} />
      <MissionPriorityBadge priority={mission.priority} />
    </div>
  );

  if (mission.status === "dismissed" || mission.status === "expired" || mission.status === "replaced") {
    const label = mission.status === "dismissed" ? "отклонена" : mission.status === "expired" ? "истекла" : "заменена на более актуальную";
    return (
      <Card className="flex flex-col gap-3">
        {metaRow}
        <p className="text-sm">
          Эта миссия {label} и больше не активна.
        </p>
        <Link href="/missions" className="focus-ring self-start text-sm font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline">
          ← Ко всем миссиям
        </Link>
      </Card>
    );
  }

  if (mission.status === "completed") {
    const total = (attempt?.correct_count ?? 0) + (attempt?.incorrect_count ?? 0);
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success)]/15">
            <Check className="h-8 w-8 text-[var(--color-success-text)]" />
          </span>
          <h2 className="text-lg font-bold">Миссия завершена</h2>
          {total > 0 && (
            <p className="text-sm text-[var(--text-secondary)]">
              {attempt?.correct_count} из {total} правильно · {formatDuration(attempt?.duration_seconds ?? null)}
            </p>
          )}
        </Card>

        {pattern && (
          <Card className="flex flex-col items-center gap-1.5 text-center">
            <p className="text-sm font-semibold">Мой английский обновлён</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <CategoryBadge category={pattern.category} />
              <StatusBadge status={pattern.status} />
              <TrendIndicator trend={pattern.trend} />
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{pattern.title}</p>
          </Card>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/home" variant="leaf">
            На главную
          </ButtonLink>
          <ButtonLink href="/language-twin" variant="ghost">
            Мой английский
          </ButtonLink>
          <ButtonLink href="/missions" variant="ghost">
            Другие миссии
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (mission.status === "started") {
    if (GRAMMAR_TYPES.has(mission.mission_type) && attempt) {
      const payload = mission.payload_json as unknown as GrammarMissionPayload;
      return (
        <div className="flex flex-col gap-3">
          {metaRow}
          <GrammarRunner
            missionId={mission.id}
            missionType={mission.mission_type}
            questions={payload.questions}
            initialAttempt={attempt}
            onComplete={handleGrammarComplete}
          />
        </div>
      );
    }
    if (TARGETED_TYPES.has(mission.mission_type)) {
      return (
        <Card className="flex flex-col gap-3">
          {metaRow}
          <p className="text-sm">
            Миссия начата — она завершится, когда ты повторишь эти карточки в Мозге.
          </p>
          <Button variant="leaf" onClick={handleContinueTargeted} className="self-start">
            Продолжить в Мозге
          </Button>
        </Card>
      );
    }
    return (
      <Card>
        {metaRow}
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Этот тип миссии пока не поддерживается интерфейсом.</p>
      </Card>
    );
  }

  // available
  const isSupported = GRAMMAR_TYPES.has(mission.mission_type) || TARGETED_TYPES.has(mission.mission_type);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        {metaRow}
        <p className="text-sm font-medium">{mission.title}</p>
        <p className="text-sm text-[var(--text-secondary)]">{reasonLabel(mission.reason_key)}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span>~{mission.estimated_minutes} мин</span>
          <span>{difficultyLabel(mission.difficulty)}</span>
          <span>Шагов: {mission.step_count}</span>
        </div>
      </Card>

      {!isSupported ? (
        <p className="text-sm text-[var(--text-secondary)]">Этот тип миссии пока не поддерживается интерфейсом.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="leaf" onClick={handleStart} disabled={isStarting}>
            {isStarting ? "Начинаем…" : "Начать"}
          </Button>
          <Button variant="ghost" onClick={handleDismiss} disabled={isDismissing}>
            {isDismissing ? "…" : "Не сейчас"}
          </Button>
        </div>
      )}
    </div>
  );
}
