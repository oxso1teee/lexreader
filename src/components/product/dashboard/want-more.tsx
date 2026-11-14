"use client";

import { CardLink } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { WantMoreHero, WantMoreItem } from "@/lib/dashboard/want-more";
import { pluralRu } from "@/lib/plural-ru";
import { track } from "@/lib/posthog-client";

function PrimaryRow({ hero }: { hero: WantMoreHero }) {
  return (
    <CardLink
      href={hero.href}
      onClick={() => track("today_primary_action_clicked", { action_type: hero.actionType, destination: hero.href })}
      className="flex flex-col gap-1"
    >
      {hero.eyebrow && (
        <p className="m-0 text-xs font-bold tracking-[0.06em] text-[var(--text-secondary)] uppercase">{hero.eyebrow}</p>
      )}
      <h3 className="m-0 text-base font-bold">{hero.title}</h3>
      {hero.subtitle && <p className="m-0 text-sm text-[var(--text-secondary)]">{hero.subtitle}</p>}
      <span className="mt-1 text-sm font-semibold text-[var(--color-forest-text)]">{hero.ctaLabel} →</span>
    </CardLink>
  );
}

// «Хочешь ещё?» (макет Today-done): цель дня выполнена, поэтому всё, что
// ниже, — необязательно. Главное действие дня остаётся здесь первой строкой
// с теми же словами и ссылкой, что были в hero.
export default function WantMore({ items }: { items: WantMoreItem[] }) {
  return (
    <section aria-labelledby="dash-more-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="dash-more-title"
          className="m-0 text-xs font-bold tracking-[0.06em] text-[var(--text-secondary)] uppercase"
        >
          Хочешь ещё?
        </h2>
        <span className="text-xs text-[var(--text-secondary)]">необязательно</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={item.kind}>
            {item.kind === "primary" && <PrimaryRow hero={item.hero} />}
            {item.kind === "reading" && (
              <CardLink href={item.href} className="flex items-center gap-3 !p-3">
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-sm font-bold">Почитать дальше</h3>
                  <p className="m-0 truncate text-xs text-[var(--text-secondary)]">{item.title}</p>
                  <Progress value={item.percentRead / 100} size="sm" label={`Прочитано ${item.percentRead}%`} className="mt-2" />
                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]">{item.percentRead}%</span>
              </CardLink>
            )}
            {item.kind === "review" && (
              <CardLink href={item.href} className="flex items-center justify-between gap-3 !p-3">
                <div className="min-w-0">
                  <h3 className="m-0 text-sm font-bold">
                    {item.dueCount} {pluralRu(item.dueCount, "слово", "слова", "слов")} на повтор
                  </h3>
                  <p className="m-0 text-xs text-[var(--text-secondary)]">
                    ~{Math.max(1, Math.round(item.dueCount / 4))} мин
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--color-forest-text)]">Повторить →</span>
              </CardLink>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
