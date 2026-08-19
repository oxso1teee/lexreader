"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { addXp } from "@/lib/xp-actions";
import { touchStreak } from "@/lib/streak";
import { checkAndAwardAchievements } from "@/lib/achievements-actions";
import { buildSpeakingFeedback, speakingXpReward, type SpeakingFeedback } from "@/lib/speaking-feedback";

export interface SubmitSpeakingResult {
  feedback: SpeakingFeedback;
  xpAwarded: number;
}

// Gamified redesign — Speak Studio. Persists the real attempt
// (speaking_attempts, migration 0042) and awards XP/streak/achievements
// via the exact same checkpoint pattern used everywhere else in this app
// (touchStreak + checkAndAwardAchievements + addXp together).
export async function submitSpeakingAttemptAction(
  prompt: string,
  transcript: string,
  durationSeconds: number,
): Promise<SubmitSpeakingResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const feedback = buildSpeakingFeedback(transcript, durationSeconds);
  const xpAwarded = speakingXpReward(feedback);

  await supabase.from("speaking_attempts").insert({
    user_id: profile.id,
    prompt,
    transcript,
    duration_seconds: durationSeconds,
    word_count: feedback.wordCount,
    xp_awarded: xpAwarded,
    feedback_json: feedback,
  });

  await touchStreak(supabase, profile.id);
  await checkAndAwardAchievements(supabase, profile.id, profile.target_language);
  if (xpAwarded > 0) await addXp(supabase, profile.id, xpAwarded);

  return { feedback, xpAwarded };
}
