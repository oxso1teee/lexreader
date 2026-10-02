"use client";

import { Flame } from "lucide-react";
import { track } from "@/lib/posthog-client";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// redesign/duolingo-flat, phase 6 — левая половина hero-ряда /home: плоская
// Card вместо forest-градиента. Какую ветку показывать (миссия/повтор/
// чтение/добавить материал), по-прежнему решает home/page.tsx (та же
// decidePrimaryAction/pickHeroMission логика) — здесь только разметка.
// Кольцо дневной цели переехало отсюда в отдельную ячейку bento
// (daily-goal-card.tsx): там оно не делит место с заголовком.
export default function HeroCard({
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  href,
  actionType,
  streak,
  footnote,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  href: string;
  /** privacy-safe category for analytics — see docs/ui/analytics-events.md */
  actionType: "mission" | "review" | "continue_reading" | "add_material";
  streak: number;
  /** "Из твоего пути: A2 → B1" — только когда hero-миссия совпадает с путём. */
  footnote?: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5 md:p-6">
      {eyebrow && (
        <span className="self-start rounded-full bg-[var(--leaf-tint)] px-3 py-1 text-[11px] font-bold tracking-wide text-[var(--leaf-text)] uppercase">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-[26px] leading-[1.15] font-bold md:text-[30px]">{title}</h2>
      {subtitle && <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
        <ButtonLink
          href={href}
          variant="leaf"
          onClick={() => track("today_primary_action_clicked", { action_type: actionType, destination: href })}
        >
          {ctaLabel}
        </ButtonLink>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] px-3 py-1.5 text-sm font-bold">
          <Flame aria-hidden="true" className="h-4 w-4 text-[var(--ember)]" />
          {streak} дн. подряд
        </span>
      </div>
      {footnote && <p className="text-xs text-[var(--text-secondary)]">{footnote}</p>}
    </Card>
  );
}
