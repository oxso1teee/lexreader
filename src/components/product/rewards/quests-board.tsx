import { Check, Gift } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QUEST_ICON } from "@/components/product/quests/quest-icons";
import { QUEST_STATUS_LABEL, questTitle, type DailyQuestItem, type QuestStatus } from "@/lib/daily-quests-model";
import type { PastQuestDay } from "@/lib/daily-quests";
import { dayLabel } from "@/lib/rewards/history";

const STATUS_TONE: Readonly<Record<QuestStatus, BadgeTone>> = {
  available: "neutral",
  in_progress: "sky",
  completed: "leaf",
  claimed: "sun",
  expired: "neutral",
};

// Полная доска заданий дня: каждое задание со статусом жизненного цикла
// (Доступно → В процессе → Выполнено → Награда получена, а у прошедшего дня — Истекло).
// Статус всегда назван словом: цвет смысл не несёт.
export function QuestsBoard({
  items,
  allComplete,
  chestClaimed,
  today,
  past,
}: {
  items: DailyQuestItem[];
  allComplete: boolean;
  chestClaimed: boolean;
  today: string;
  past: PastQuestDay[];
}) {
  return (
    <Card as="section" aria-labelledby="rewards-quests-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="rewards-quests-title" className="text-h2 m-0">
          Задания дня
        </h2>
        {chestClaimed ? (
          <Badge tone="sun">Сундук открыт</Badge>
        ) : (
          <span className="text-caption text-[var(--text-secondary)]">
            {items.filter((i) => i.done).length}/{items.length} выполнено
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-body-sm m-0 text-[var(--text-secondary)]">Задания на сегодня пока не готовы. Загляни чуть позже.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item) => (
            <QuestRow key={item.questType} item={item} />
          ))}
        </ul>
      )}

      {allComplete && !chestClaimed && (
        <ButtonLink href="/quests/chest" variant="sun" block>
          <Gift aria-hidden="true" className="h-5 w-5" />
          Открыть сундук
        </ButtonLink>
      )}
      {!allComplete && items.length > 0 && (
        <p className="text-caption m-0 text-[var(--text-secondary)]">Выполни все задания до конца дня — получишь сундук: XP, заморозку серии и Double-XP.</p>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
          <h3 className="text-body-sm m-0 font-semibold">Прошлые дни</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {past.map((day) => (
              <li key={day.day} className="flex items-center justify-between gap-3">
                <span className="text-body-sm">{dayLabel(day.day, today)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-caption tabular-nums text-[var(--text-secondary)]">
                    {day.items.filter((i) => i.done).length}/{day.items.length}
                  </span>
                  <Badge tone={day.claimed ? "sun" : "neutral"}>{day.claimed ? QUEST_STATUS_LABEL.claimed : QUEST_STATUS_LABEL.expired}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function QuestRow({ item }: { item: DailyQuestItem }) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-lg"
      >
        {QUEST_ICON[item.questType]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-sm min-w-0 font-semibold">{questTitle(item.questType, item.target)}</span>
          <Badge tone={STATUS_TONE[item.status]}>
            {item.done && <Check aria-hidden="true" className="h-3 w-3" />}
            {QUEST_STATUS_LABEL[item.status]}
          </Badge>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Progress
            className="flex-1"
            size="sm"
            value={item.target > 0 ? item.current / item.target : 0}
            tone={item.done ? "leaf" : "sun"}
            label={`${questTitle(item.questType, item.target)}: ${item.current} из ${item.target}`}
          />
          <span className="text-caption tabular-nums text-[var(--text-secondary)]">
            {item.current}/{item.target}
          </span>
        </div>
      </div>
    </li>
  );
}
