import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import type { DuelState } from "@/lib/duel";
import DuelRoom from "./duel-room";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3.
// SSR только для начального состояния (без "мигания" при загрузке) —
// живая часть (realtime-подписка, join/answer) целиком в duel-room.tsx
// (client component), т.к. ей в любом случае нужен браузерный Supabase-
// клиент для .channel()/postgres_changes.
export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();
  const { data: initialState } = await supabase.rpc("get_duel_state", { p_duel_id: id });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <DuelRoom duelId={id} initialState={(initialState as DuelState | null) ?? null} inviteUrl={`${siteUrl()}/duel/${id}`} />
    </div>
  );
}
