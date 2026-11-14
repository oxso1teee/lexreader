import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dayLabel, type XpHistoryDay } from "@/lib/rewards/history";
import { XP_SOURCES } from "@/lib/xp/sources";

// История XP: что и когда принесло опыт (журнал xp_events), и памятка «за что даётся XP»
// из каталога источников — правила берутся из того же места, по которому считает сервер.
export function XpHistory({ days, today }: { days: XpHistoryDay[]; today: string }) {
  return (
    <Card as="section" aria-labelledby="rewards-history-title" className="flex flex-col gap-3">
      <h2 id="rewards-history-title" className="text-h2 m-0">
        История XP
      </h2>

      {days.length === 0 ? (
        <p className="text-body-sm m-0 text-[var(--text-secondary)]">
          Пока пусто. Пройди урок, прочитай текст или повтори слова — начисления появятся здесь.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {days.map((day) => (
            <li key={day.day} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-body-sm m-0 font-semibold">{dayLabel(day.day, today)}</h3>
                <span className="text-body-sm tabular-nums font-semibold text-[var(--sun-text)]">+{day.total} XP</span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {day.events.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="min-w-0">
                      {event.label}
                      {event.boosted && (
                        <Badge tone="sun" className="ml-2">
                          ×2
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">+{event.amount}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <details className="border-t border-[var(--border)] pt-3">
        <summary className="text-body-sm cursor-pointer font-semibold">За что даётся XP</summary>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {Object.values(XP_SOURCES).map((source) => (
            <li key={source.id} className="text-caption text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text)]">{source.label}.</span> {source.rule}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
