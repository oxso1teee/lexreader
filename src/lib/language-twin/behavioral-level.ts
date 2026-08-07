// Deterministic, deliberately coarse behavioral level estimate (plan doc
// §14/§17) — never a precise CEFR letter+number, always a range, and only
// returned once there's enough vocabulary to say anything at all.
const MIN_VOCAB_FOR_ESTIMATE = 15;

export function behavioralLevelRange(observedReceptiveVocabulary: number, avgReviewAccuracy: number | null): string | null {
  if (observedReceptiveVocabulary < MIN_VOCAB_FOR_ESTIMATE) return null;

  // Vocabulary size gives the coarse band; accuracy (when there's enough
  // review history to trust it) nudges within it — never the reverse, so a
  // small but 100%-accurate vocabulary still can't imply a level it doesn't
  // have the breadth for.
  let band: string;
  if (observedReceptiveVocabulary >= 3000) band = "B2+";
  else if (observedReceptiveVocabulary >= 1500) band = "B1–B2";
  else if (observedReceptiveVocabulary >= 500) band = "A2–B1";
  else band = "A1–A2";

  if (avgReviewAccuracy !== null && avgReviewAccuracy < 0.5 && band !== "A1–A2") {
    // Large saved vocabulary but poor recall — don't claim the upper band.
    const downshift: Record<string, string> = { "B2+": "B1–B2", "B1–B2": "A2–B1", "A2–B1": "A1–A2" };
    band = downshift[band] ?? band;
  }

  return band;
}
