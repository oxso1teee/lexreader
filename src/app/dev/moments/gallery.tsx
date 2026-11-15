"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MOMENT_FIXTURES } from "@/lib/moments/fixtures";
import { renderMoment } from "@/components/product/moments/moment-provider";
import AppShell from "@/components/product/app-shell/app-shell";
import DashboardView from "@/components/product/dashboard/dashboard-view";
import { DASHBOARD_REGULAR_FIXTURE } from "@/lib/screen-fixtures";

export default function MomentsGallery({ names, open }: { names: string[]; open: string | null }) {
  const router = useRouter();
  if (open) {
    // Под моментом — главный экран, как в живом приложении: шторки
    // (Review-due, Rate-app) затемняют его, полноэкранные — закрывают.
    return (
      <>
        <AppShell planLabel={null}>
          <DashboardView {...DASHBOARD_REGULAR_FIXTURE} />
        </AppShell>
        {renderMoment(MOMENT_FIXTURES[open], () => router.push("/dev/moments"))}
      </>
    );
  }
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="font-display text-2xl font-bold">Моменты</h1>
      <p className="text-sm text-[var(--text-secondary)]">Эталон каждого экрана: docs/moments/reference/&lt;имя&gt;.png</p>
      {names.map((n) => (
        <Link key={n} href={`/dev/moments?m=${n}`} className="btn btn-ghost btn-md justify-start">
          {n}
        </Link>
      ))}
    </main>
  );
}
