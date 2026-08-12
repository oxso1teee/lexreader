import Link from "next/link";
import type { ReactNode } from "react";
import PageHeader from "@/components/product/page-header";

// Same "eyebrow + back-link, no second nav layer" pattern as
// missions/sub-header.tsx and language-twin/sub-header.tsx (plan doc §11:
// "Мой путь / ← Назад", no new bottom-nav item — /library already owns
// "Учиться").
export default function LearningPathsSubHeader({
  title,
  description,
  action,
  backHref = "/learning-paths",
  backLabel = "Ко всем путям",
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
        <span className="text-xs font-medium text-[var(--text-secondary)]">Мой путь</span>
        <Link
          href={backHref}
          className="focus-ring self-start text-sm font-medium text-[var(--color-caramel-text)] underline-offset-2 hover:underline"
        >
          ← {backLabel}
        </Link>
      </div>
      <PageHeader title={title} description={description} action={action} />
    </div>
  );
}
