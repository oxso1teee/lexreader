"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { addXp } from "@/lib/xp-actions";
import { touchStreak } from "@/lib/streak";
import { checkAndAwardAchievements } from "@/lib/achievements-actions";

const XP_PER_CORRECT_ANSWER = 2;

// Gamified redesign — Grammar Gym is a free-practice mode (not a graded
// Mission, no mission_attempts row to attach to), so individual answers
// aren't persisted -- same "exposure practice, not everything logged"
// tradeoff already accepted elsewhere in this app (this session's own
// state lives in the client only). What IS real: the XP/streak/
// achievement award at the end, via the exact same checkpoint pattern
// used by brain review (src/app/(app)/brain/[deckId]/review/actions.ts)
// and reading (src/app/read/[textId]/actions.ts).
export async function completeGrammarGymSessionAction(correctCount: number): Promise<{ xpAwarded: number }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const xpAwarded = Math.max(0, correctCount) * XP_PER_CORRECT_ANSWER;
  await touchStreak(supabase, profile.id);
  await checkAndAwardAchievements(supabase, profile.id, profile.target_language);
  if (xpAwarded > 0) await addXp(supabase, profile.id, xpAwarded);

  return { xpAwarded };
}
