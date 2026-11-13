"use client";

import { DUEL_INVITE_FIXTURE, DUEL_WON_FIXTURE } from "@/lib/screen-fixtures";
import { DuelInviteScreen } from "@/components/product/moments/screens/duel-invite";
import { DuelWonScreen } from "@/components/product/moments/screens/duel-won";

const noop = () => {};

export function Stage6GalleryScreen({ s }: { s: string }) {
  if (s === "Duel-invite") return <DuelInviteScreen state={DUEL_INVITE_FIXTURE} busy={false} onAccept={noop} onDecline={noop} />;
  if (s === "Duel-won") return <DuelWonScreen state={DUEL_WON_FIXTURE.state} result={DUEL_WON_FIXTURE.result} onRematch={noop} onClose={noop} />;
  return null;
}
