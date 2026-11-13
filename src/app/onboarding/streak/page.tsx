import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import StreakCommitClient from "./streak-commit-client";

export default async function StreakCommitPage() {
  const profile = await requireProfile();
  if (profile.completed_first_win) redirect("/home");

  return <StreakCommitClient />;
}
