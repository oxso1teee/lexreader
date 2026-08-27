import Link from "next/link";
import type { ReactNode } from "react";
import PageHeader from "@/components/product/page-header";

// UX fix 2026-08-07: every Language Twin sub-route used to render its own
// PageHeader plus a persistent horizontal LanguageTwinNav strip (8 pill
// links) above it — together they read as a second app shell nested inside
// LexReader. LanguageTwinNav is gone; this replaces it with the same
// lightweight "where am I / how do I get back" cue used nowhere else in the
// app because nowhere else needed one — Language Twin is the only feature
// with a sub-route tree deep enough that a bare PageHeader would strand the
// user, so it gets an eyebrow + back-link instead of a second nav layer.
export default function LanguageTwinSubHeader({
  title,
  description,
  action,
  backHref = "/language-twin",
  backLabel = "Назад к профилю",
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
        <span className="text-xs font-medium text-[var(--text-secondary)]">Мой английский</span>
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
