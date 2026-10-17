"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MOMENT_FIXTURES } from "@/lib/moments/fixtures";
import { renderMoment } from "@/components/product/moments/moment-provider";

export default function MomentsGallery({ names, open }: { names: string[]; open: string | null }) {
  const router = useRouter();
  if (open) {
    return renderMoment(MOMENT_FIXTURES[open], () => router.push("/dev/moments"));
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
