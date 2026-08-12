import type { MissionRow } from "@/lib/missions/types";
import type { Skill } from "./types";

// M3 Slice 8 Phase C — "Потренировать" CTA (plan doc §11): looks for a
// relevant ALREADY-ACTIVE mission via the existing skill_category match,
// reusing Missions' own dedup/cooldown (getOrGenerateActiveMissions).
// Never manually inserts a duplicate mission and never requests one
// targeted to a specific skill — the Missions engine has no such API, and
// faking one would violate the "no fake automation" rule. When nothing
// matches, the caller shows an honest "no active practice for this yet"
// state instead of a broken or fabricated CTA.
export function findMatchingMissionForSkill(missions: MissionRow[], skill: Skill): MissionRow | null {
  const active = missions.filter((m) => m.status === "available" || m.status === "started");

  if (skill.missionTypeHint) {
    return active.find((m) => m.mission_type === skill.missionTypeHint) ?? null;
  }
  if (!skill.category) return null;
  return active.find((m) => m.skill_category === skill.category) ?? null;
}
