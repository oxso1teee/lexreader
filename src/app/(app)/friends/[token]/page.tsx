import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/product/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptFriendStreakInviteAction } from "../actions";

// docs/moments/ROADMAP.md, этап 6 — Friend-streak: страница принятия
// приглашения (симметрична /duel/[id]'s "присоединиться" для не-участника).
export default async function FriendsAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  await requireProfile();
  const accept = acceptFriendStreakInviteAction.bind(null, token);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Приглашение в общую серию" description="Каждый занимается сам, серия общая." />

      {error && (
        <p role="alert" className="rounded-2xl border border-[var(--color-danger-text)]/25 bg-[var(--color-danger-text)]/10 p-3 text-body-sm text-[var(--color-danger-text)]">
          {decodeURIComponent(error)}
        </p>
      )}

      <Card as="section" className="p-6 text-center">
        <p className="text-body-sm mb-4 text-[var(--text-secondary)]">
          Пропустит один — сгорит у обоих. Готов начать серию вместе?
        </p>
        <form action={accept}>
          <Button type="submit" variant="leaf">
            Принять приглашение
          </Button>
        </form>
      </Card>

      <Link href="/streak" className="focus-ring self-start text-body-sm text-[var(--color-forest-text)]">
        ← К серии
      </Link>
    </div>
  );
}
