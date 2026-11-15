import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import GoalPickClient from "./goal-pick-client";

export default async function GoalPickPage() {
  const profile = await requireProfile();
  if (profile.completed_first_win) redirect("/home");

  return <GoalPickClient initialXpGoal={profile.daily_xp_goal} />;
}
