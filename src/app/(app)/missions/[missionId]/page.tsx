import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMissionAction, getMissionAttemptAction } from "../actions";
import type { PatternRow } from "@/lib/language-twin/types";
import MissionsSubHeader from "../sub-header";
import MissionScreen from "./mission-screen";

export default async function MissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const profile = await requireProfile();
  const mission = await getMissionAction(missionId);
  if (!mission) notFound();
  const attempt = await getMissionAttemptAction(missionId);

  // Result screen shows the pattern's CURRENT state, not a stale snapshot —
  // fetched fresh on every visit, same source of truth as /language-twin.
  let pattern: Pick<PatternRow, "title" | "category" | "status" | "trend"> | null = null;
  if (mission.status === "completed" && mission.source_pattern_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("language_error_patterns")
      .select("title, category, status, trend")
      .eq("id", mission.source_pattern_id)
      .eq("user_id", profile.id)
      .maybeSingle();
    pattern = data;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <MissionsSubHeader title={mission.title} />
      <MissionScreen mission={mission} initialAttempt={attempt} initialPattern={pattern} />
    </div>
  );
}
