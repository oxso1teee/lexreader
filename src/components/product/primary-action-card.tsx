"use client";

import Link from "next/link";
import { track } from "@/lib/posthog-client";

// Единственный главный CTA на Today (docs/ui/unified-ui-slice-1-plan.md,
// раздел "Redesign Today"). Domain-safe props — вызывающий код решает,
// какой текст/route показать, компонент не знает про due_at/FSRS/тексты.
export default function PrimaryActionCard({
  eyebrow,
  title,
  description,
  ctaLabel,
  href,
  actionType,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  ctaLabel: string;
  href: string;
  /** privacy-safe category for analytics — see docs/ui/analytics-events.md */
  actionType: "review" | "continue_reading" | "add_material";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-caramel to-caramel-light p-5 text-white shadow-sm">
      {eyebrow && <span className="text-label uppercase tracking-wide text-white/70">{eyebrow}</span>}
      <div>
        <h2 className="text-h2">{title}</h2>
        {description && <p className="text-body-sm mt-1 text-white/85">{description}</p>}
      </div>
      <Link
        href={href}
        onClick={() => track("today_primary_action_clicked", { action_type: actionType, destination: href })}
        className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-black/85 px-5 text-center text-sm font-semibold text-white hover:bg-black/70"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
