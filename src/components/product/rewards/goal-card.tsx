"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Target } from "lucide-react";
import { saveDailyGoalAction } from "@/app/(app)/rewards/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui";
import { minutesHintForGoal } from "@/lib/daily-goal";
import { GOAL_TYPES, GOAL_TYPE_DEFS, formatGoalAmount, isGoalType, type DailyGoalType } from "@/lib/goals/config";
import type { DailyGoalProgress } from "@/lib/dashboard/goal";

// Цель дня на экране наград: прогресс по выбранному типу и редактор (тип + размер из
// пресетов). Сохранение — server action с повторной проверкой; прогресс считает
// сервер из реальной активности (goals/activity.ts), здесь только показ и выбор.
export function GoalCard({ goal, defaultEditing = false }: { goal: DailyGoalProgress; /** Только для галереи состояний: редактор открыт сразу. */ defaultEditing?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(defaultEditing);
  const [type, setType] = useState<DailyGoalType>(goal.type);
  const [target, setTarget] = useState<number>(goal.target);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const def = GOAL_TYPE_DEFS[type];

  function chooseType(next: string) {
    if (!isGoalType(next)) return;
    setType(next);
    const presets = GOAL_TYPE_DEFS[next].presets;
    setTarget(presets.includes(target) ? target : GOAL_TYPE_DEFS[next].defaultTarget);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveDailyGoalAction(type, target);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Цель дня сохранена");
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setType(goal.type);
    setTarget(goal.target);
    setError(null);
    setEditing(false);
  }

  return (
    <Card as="section" aria-labelledby="rewards-goal-title" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="rewards-goal-title" className="text-h2 m-0 flex items-center gap-2">
            <Target aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--sun-text)]" />
            Цель дня
          </h2>
          <p className="text-caption m-0 mt-0.5 text-[var(--text-secondary)]">
            {GOAL_TYPE_DEFS[goal.type].title} · {formatGoalAmount(goal.type, goal.target)} в день
          </p>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-expanded={false} aria-controls="goal-editor">
            Изменить
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-h2 m-0 tabular-nums">
            {goal.current}
            <span className="text-body-sm font-normal text-[var(--text-secondary)]">
              {" "}
              / {goal.target} {goal.unitMany}
            </span>
          </p>
          {goal.done ? (
            <span className="text-body-sm inline-flex items-center gap-1 font-semibold text-[var(--leaf-text)]">
              <Check aria-hidden="true" className="h-4 w-4" />
              Выполнена
            </span>
          ) : (
            <span className="text-body-sm text-[var(--text-secondary)]">Ещё {goal.remainingLabel}</span>
          )}
        </div>
        <Progress value={goal.value} tone={goal.done ? "leaf" : "sun"} label={`Цель дня: ${goal.current} из ${goal.target} ${goal.unitMany}`} />
      </div>

      {editing && (
        <div id="goal-editor" className="flex flex-col gap-4 border-t border-[var(--border)] pt-4">
          <ChoiceGroup
            legend="Что считать целью дня"
            name="goal-type"
            value={type}
            onValueChange={chooseType}
            columns={2}
            options={GOAL_TYPES.map((t) => ({ value: t, label: GOAL_TYPE_DEFS[t].title, description: GOAL_TYPE_DEFS[t].description }))}
          />
          <ChoiceGroup
            legend={`Сколько в день: ${def.title}`}
            name="goal-target"
            value={String(target)}
            onValueChange={(v) => setTarget(Number(v))}
            columns={2}
            options={def.presets.map((n) => ({
              value: String(n),
              label: formatGoalAmount(type, n),
              description: type === "xp" ? `~${minutesHintForGoal(n)} мин занятия` : undefined,
            }))}
          />
          {error && <Alert tone="error" live="assertive">{error}</Alert>}
          <div className="flex gap-2">
            <Button variant="leaf" loading={pending} onClick={save}>
              Сохранить
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={pending}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
