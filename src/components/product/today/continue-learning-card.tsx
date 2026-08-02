"use client";

import Link from "next/link";
import { track } from "@/lib/posthog-client";
import ProgressBar from "@/components/product/progress-bar";
import EmptyState from "@/components/empty-state";

export default function ContinueLearningCard({
  material,
}: {
  material: { textId: string; title: string; percentRead: number } | null;
}) {
  if (!material) {
    return (
      <div className="rounded-xl bg-[var(--surface)] p-4 shadow-sm">
        <EmptyState
          icon="📖"
          title="Пока нет материала в процессе"
          body="Начни читать что-нибудь — прогресс появится здесь."
          action={
            <Link href="/library" className="focus-ring text-body-sm font-semibold text-[var(--color-caramel-text)]">
              Открыть библиотеку →
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <Link
      href={`/read/${material.textId}`}
      onClick={() => track("continue_learning_clicked", { destination: `/read/${material.textId}` })}
      className="focus-ring block rounded-xl bg-[var(--surface)] p-4 shadow-sm"
    >
      <p className="text-caption uppercase tracking-wide">Продолжить чтение</p>
      <p className="text-body mt-1 truncate font-semibold">{material.title}</p>
      <div className="mt-2">
        <ProgressBar ratio={material.percentRead / 100} label={`${material.percentRead}% прочитано`} />
      </div>
    </Link>
  );
}
