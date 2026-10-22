import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/product/page-header";
import InviteCard from "./invite-card";

// docs/moments/ROADMAP.md, этап 6 — Friend-streak: страница создания
// приглашения (симметрична /duel как "страница-лендинг").
export default async function FriendsInvitePage() {
  await requireProfile();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader
        title="Общая серия с другом"
        description="Каждый занимается сам, серия общая. Пропустит один — сгорит у обоих."
      />
      <InviteCard />
      <Link href="/streak" className="focus-ring self-start text-body-sm text-[var(--color-forest-text)]">
        ← К серии
      </Link>
    </div>
  );
}
