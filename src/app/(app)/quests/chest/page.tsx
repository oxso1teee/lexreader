import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getDailyQuestsSnapshot } from "@/lib/daily-quests";
import { ChestScreen } from "@/components/product/quests/chest-screen";
import { redirect } from "next/navigation";

// docs/moments/mockups/Chest.dc.html — доступ только если задания дня
// реально выполнены и сундук ещё не забран (claimChestAction сам же это
// перепроверяет перед начислением — здесь только честный UX-гейт, не
// единственная защита).
export default async function ChestPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const snapshot = await getDailyQuestsSnapshot(supabase, profile.id, profile.target_language);
  if (!snapshot.allComplete || snapshot.chestClaimedToday) {
    redirect("/home");
  }
  return <ChestScreen />;
}
