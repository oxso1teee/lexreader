import { Check, Copy, Zap } from "lucide-react";
import { CardLink } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import type { DailyGoalProgress } from "@/lib/dashboard/goal";
import { pluralRu } from "@/lib/plural-ru";

// Две плитки под hero: прогресс цели дня и очередь повторения. Обе — ссылки;
// числа берутся из реальных данных (activity_days.xp, srs_state).
export function GoalTile({ goal }: { goal: DailyGoalProgress }) {
  const Icon = goal.done ? Check : Zap;
  return (
    <CardLink href="/progress" className="dash-tile">
      {/* Кольцо — наглядная часть ссылки: значение уже названо текстом рядом. */}
      <div aria-hidden="true" className="inline-flex shrink-0">
        <ProgressRing
          value={goal.value}
          tone="sun"
          size={56}
          stroke={6}
          label={`Цель дня: ${goal.xpToday} из ${goal.xpGoal} XP`}
        >
          <Icon aria-hidden="true" className="h-5 w-5 text-[var(--sun-text)]" />
        </ProgressRing>
      </div>
      <div className="min-w-0">
        <div className="dash-tile-value">
          {goal.xpToday}/{goal.xpGoal}
        </div>
        <div className="dash-tile-label">{goal.done ? "Цель дня выполнена" : "XP сегодня"}</div>
      </div>
    </CardLink>
  );
}

// Число карточек к повтору показываем всегда, без выводов вроде «всё
// повторено»: ноль значит лишь «сейчас нечего повторять» (карточек может ещё
// не быть вовсе). Без карточек плитка ведёт в раздел практики, а не в пустое
// повторение.
export function DueTile({ dueCount }: { dueCount: number }) {
  const hasDue = dueCount > 0;
  return (
    <CardLink href={hasDue ? "/brain/all/review" : "/brain"} className="dash-tile">
      <div
        aria-hidden="true"
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[var(--sky-tint)] text-[var(--sky-text)]"
      >
        <Copy className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="dash-tile-value">
          {dueCount} {pluralRu(dueCount, "слово", "слова", "слов")}
        </div>
        <div className="dash-tile-label">ждут повтора</div>
      </div>
    </CardLink>
  );
}
