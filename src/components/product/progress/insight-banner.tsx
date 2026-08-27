"use client";

import Link from "next/link";
import { track } from "@/lib/posthog-client";
import type { ProgressInsight } from "@/lib/progress-insight";

export default function InsightBanner({ insight }: { insight: ProgressInsight }) {
  return (
    <div className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm" role="status" aria-live="polite">
      <p className="text-body">{insight.message}</p>
      {insight.ctaHref && insight.ctaLabel && (
        <Link
          href={insight.ctaHref}
          onClick={() => track("progress_insight_clicked", { insight_key: insight.key, destination: insight.ctaHref })}
          className="focus-ring mt-2 inline-block text-body-sm font-semibold text-[var(--color-forest-text)]"
        >
          {insight.ctaLabel} →
        </Link>
      )}
    </div>
  );
}
