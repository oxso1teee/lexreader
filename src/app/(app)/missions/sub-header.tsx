import Link from "next/link";
import type { ReactNode } from "react";
import PageHeader from "@/components/product/page-header";

// Same "eyebrow + back-link, no second nav layer" pattern as
// language-twin/sub-header.tsx — Missions has a sub-route tree
// (/missions/[id], /missions/history) but no entry of its own in the
// App Shell's nav, so it needs the same "where am I" cue.
export default function MissionsSubHeader({
  title,
  description,
  action,
  backHref = "/missions",
  backLabel = "Ко всем миссиям",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-[var(--text-secondary)]">Миссии</span>
        <Link
          href={backHref}
          className="focus-ring self-start text-sm font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
        >
          ← {backLabel}
        </Link>
      </div>
      <PageHeader title={title} description={description} action={action} />
    </div>
  );
}
