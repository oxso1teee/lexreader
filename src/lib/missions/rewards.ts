import type { MissionDifficulty } from "./types";

// Gamified redesign — Missions never had an XP concept at all (no column,
// no addXp call anywhere in missions/actions.ts) even though the reference
// shows a real "+XP" reward badge on every mission card. Rather than show
// a number the app doesn't actually pay out (a fake reward), this derives
// a real amount from fields the mission already has (step_count,
// difficulty) and completeMissionAction awards exactly this amount via the
// same addXp/touchStreak/checkAndAwardAchievements checkpoint used
// elsewhere (brain review, reading) -- see docs/ui plan.
const DIFFICULTY_BONUS: Record<MissionDifficulty, number> = {
  easy: 0,
  medium: 5,
  hard: 10,
};

export function missionXpReward(mission: { step_count: number; difficulty: MissionDifficulty }): number {
  return mission.step_count * 3 + DIFFICULTY_BONUS[mission.difficulty];
}
