import type { SupabaseServerClient } from "@/lib/supabase/server";
// Relative import (not the "@/" alias) — this file is unit-tested directly
// via plain `node --test`, which doesn't resolve tsconfig path aliases;
// Next.js resolves either form fine.
import { getHardestWords, type HardestWord } from "../brain-stats.ts";

// Generalizes brain-stats.ts's computeHardestWords (plan doc §6) rather than
// reimplementing the same review_log aggregation — reuses its exact
// MIN_ATTEMPTS_FOR_ACCURACY floor and grade>=2-is-success convention.
const RECALL_ACCURACY_THRESHOLD = 0.5;
// Generous but bounded — keeps this an on-demand-recompute query, not an
// unbounded "load every card ever reviewed" call (perf constraint, plan §30).
const MAX_CANDIDATES = 200;

export type RecallGapWord = HardestWord;

// Pure filter step, split out from the query so it's unit-testable without a
// database. excludeIds lets the recompute step avoid double-reporting a card
// already covered by the activation-gap pattern.
export function filterRecallGaps(words: HardestWord[], excludeIds: Set<string> = new Set()): RecallGapWord[] {
  return words.filter((w) => !excludeIds.has(w.id) && w.accuracy < RECALL_ACCURACY_THRESHOLD);
}

export async function getRecallGaps(
  supabase: SupabaseServerClient,
  userId: string,
  language: string,
  excludeIds: Set<string> = new Set(),
): Promise<RecallGapWord[]> {
  const words = await getHardestWords(supabase, userId, language, MAX_CANDIDATES);
  return filterRecallGaps(words, excludeIds);
}
