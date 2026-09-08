import type { VocabularyStatus } from "@/lib/types";

export const KNOWN_LEVEL = 4;

export function statusFromLevel(level: number): VocabularyStatus {
  if (level >= 4) return "known";
  if (level >= 1) return "learning";
  return "new";
}

// Single source of truth for keeping status and level in sync.
// Used by notebook/actions.ts (markKnown) and read/[textId]/actions.ts (setWordLevel).
export function syncStatusAndLevel(level: number): { status: VocabularyStatus; level: number } {
  return { status: statusFromLevel(level), level };
}
