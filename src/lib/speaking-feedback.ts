import { splitIntoSentences } from "./tokenize.ts";
import { checkSentence, type CorrectionMatch } from "./language-twin/correction-rules.ts";

// Gamified redesign — Speak Studio feedback. Deliberately NOT a
// pronunciation score: no paid speech-scoring API exists or is being
// added (matches "prefer free tools"). What's real here: a genuine
// browser-recorded transcript (SpeechRecognition, same mechanism as the
// existing mic-button.tsx), run through the SAME deterministic grammar-
// pattern engine Language Twin's Correction Input already uses
// (checkSentence, per-sentence since it caps input length), plus honest
// word-count/variety metrics. No invented score.
export interface SpeakingFeedback {
  wordCount: number;
  durationSeconds: number;
  wordsPerMinute: number;
  uniqueWordRatio: number;
  grammarMatches: CorrectionMatch[];
}

export function buildSpeakingFeedback(transcript: string, durationSeconds: number): SpeakingFeedback {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const uniqueWordRatio =
    wordCount > 0 ? new Set(words.map((w) => w.toLowerCase())).size / wordCount : 0;
  const wordsPerMinute = durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;

  const grammarMatches: CorrectionMatch[] = [];
  for (const sentence of splitIntoSentences(transcript)) {
    const result = checkSentence(sentence);
    if (result.supported) grammarMatches.push(...result.matches);
  }

  return { wordCount, durationSeconds, wordsPerMinute, uniqueWordRatio, grammarMatches };
}

/** XP for a real, honest attempt -- rewards actually speaking (word count),
 * not correctness (no invented pronunciation score to grade against). */
export function speakingXpReward(feedback: SpeakingFeedback): number {
  return Math.min(30, Math.round(feedback.wordCount / 2));
}
