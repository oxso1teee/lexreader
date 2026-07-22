import type { VocabularyStatus } from "@/lib/types";

export const KNOWN_LEVEL = 4;

export function statusFromLevel(level: number): VocabularyStatus {
  if (level >= 4) return "known";
  if (level >= 1) return "learning";
  return "new";
}
