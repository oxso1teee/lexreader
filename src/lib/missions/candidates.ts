import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { ConfidenceLevel, PatternCategory, PatternRow, Severity } from "@/lib/language-twin/types";
import { GRAMMAR_RUNNER_CATEGORIES } from "./grammar-bank.ts";
import type { MissionCandidateInput, MissionHistoryEntry } from "./types.ts";

const GRAMMAR_CATEGORY_SET = new Set<PatternCategory>(GRAMMAR_RUNNER_CATEGORIES);

function patternWordIds(pattern: Pick<PatternRow, "metadata_json">): string[] {
  const words = (pattern.metadata_json as { words?: { flashcardId?: string }[] }).words ?? [];
  return words.map((w) => w.flashcardId).filter((id): id is string => Boolean(id));
}

// Reads active/improving Language Twin patterns and recent diagnostic
// evidence, maps them into mission candidates. Read-only, no writes — the
// caller decides what to do with the result (plan doc §7/§8: this is the
// "inputs" half of generation, generateMissionDrafts is the pure "decide"
// half). Every candidate here traces to a real row a user can see
// elsewhere in the product (Language Twin patterns, their own diagnostic
// history) — nothing is invented for the sake of having something to show.
export async function fetchMissionCandidates(supabase: SupabaseServerClient, userId: string, language: string): Promise<MissionCandidateInput[]> {
  const candidates: MissionCandidateInput[] = [];
  let hasActivationGapCandidate = false;

  const { data: patternsData } = await supabase
    .from("language_error_patterns")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "improving", "uncertain", "resolved"]);
  const patterns = (patternsData ?? []) as PatternRow[];

  for (const pattern of patterns) {
    if (pattern.category === "activation") {
      const wordIds = patternWordIds(pattern);
      if (wordIds.length === 0) continue;
      candidates.push(buildCandidate(pattern, "vocab_activation", "activation_gap", wordIds.slice(0, 5)));
      hasActivationGapCandidate = true;
      continue;
    }
    if (pattern.category === "review_recall") {
      const wordIds = patternWordIds(pattern);
      if (wordIds.length === 0) continue;
      candidates.push(buildCandidate(pattern, "review_recovery", "repeated_failure", wordIds.slice(0, 5)));
      continue;
    }
    if (!GRAMMAR_CATEGORY_SET.has(pattern.category)) continue; // no honest exercise runner for this category (spelling/collocation/other)

    if (pattern.status === "improving" || pattern.status === "resolved") {
      if (pattern.confidence !== "high") continue; // maintenance only for genuinely well-established patterns
      candidates.push(buildCandidate(pattern, "maintenance", "maintenance"));
      continue;
    }
    const missionType = pattern.pattern_key.startsWith("correction_") ? "correction" : "grammar_pattern";
    candidates.push(buildCandidate(pattern, missionType, missionType === "correction" ? "grammar_pattern" : "grammar_pattern"));
  }

  candidates.push(...(await fetchDiagnosticFollowupCandidates(supabase, userId)));
  candidates.push(...(await fetchPhraseActivationCandidate(supabase, userId)));
  // M3 Slice 10 (task #279): activation_gap requires BOTH a reading-level-4 tap AND a narrow
  // review-accuracy window — real, but a narrow intersection that misses most words (manually
  // added, imported, or never read at all). learning_state='familiar' is Slice 10's own broader,
  // more direct "ready to push toward active" signal, computed for every word/phrase regardless
  // of origin — only used here as a fallback so a user is never shown two differently-sourced
  // "Активация словаря" missions at once (hasActivationGapCandidate guards that).
  if (!hasActivationGapCandidate) {
    candidates.push(...(await fetchFamiliarVocabCandidate(supabase, userId, language)));
  }

  return candidates;
}

function buildCandidate(
  pattern: PatternRow,
  missionType: MissionCandidateInput["missionType"],
  reasonKey: string,
  wordIds?: string[],
): MissionCandidateInput {
  return {
    missionType,
    sourcePatternId: pattern.id,
    sourceRecommendationId: null,
    skillCategory: pattern.category,
    severity: pattern.severity,
    confidence: pattern.confidence,
    trend: pattern.trend,
    evidenceCount: pattern.evidence_count,
    updatedAt: pattern.updated_at,
    title: pattern.title,
    reasonKey,
    wordIds,
  };
}

// Diagnostic follow-up: the most recent diagnostic session's own per-tag
// results (scoreDiagnostic's byTag, already computed and stored at
// submission time — see language-twin/diagnostic.ts) name which categories
// the user answered wrong. A category with zero correct answers there is a
// real, honest weak-signal — not a fabricated one.
async function fetchDiagnosticFollowupCandidates(supabase: SupabaseServerClient, userId: string): Promise<MissionCandidateInput[]> {
  const { data } = await supabase
    .from("language_evidence")
    .select("metadata_json, occurred_at")
    .eq("user_id", userId)
    .eq("evidence_type", "diagnostic_result")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return [];

  const byTag = (data.metadata_json as { byTag?: Record<string, { correct: number; total: number }> }).byTag ?? {};
  const candidates: MissionCandidateInput[] = [];
  for (const [category, score] of Object.entries(byTag)) {
    if (!GRAMMAR_CATEGORY_SET.has(category as PatternCategory)) continue;
    if (score.total === 0 || score.correct === score.total) continue; // only genuinely weak tags
    const severity: Severity = score.correct === 0 ? "high" : "medium";
    const confidence: ConfidenceLevel = score.total >= 2 ? "medium" : "low";
    candidates.push({
      missionType: "diagnostic_followup",
      sourcePatternId: null,
      sourceRecommendationId: null,
      skillCategory: category as PatternCategory,
      severity,
      confidence,
      trend: "flat",
      evidenceCount: score.total,
      updatedAt: data.occurred_at,
      title: `Диагностика: ${category}`,
      reasonKey: "diagnostic_followup",
    });
  }
  return candidates;
}

// Phrase activation: phrases saved via Correction/Reader (phrase_saved
// evidence) whose flashcard hasn't graduated past a low repetition count
// yet — the same "recognized but not yet solid" shape as activation_gap,
// scoped to phrase-origin cards specifically since they have no dedicated
// language_error_patterns category of their own.
async function fetchPhraseActivationCandidate(supabase: SupabaseServerClient, userId: string): Promise<MissionCandidateInput[]> {
  const { data: evidenceRows } = await supabase
    .from("language_evidence")
    .select("source_id, occurred_at")
    .eq("user_id", userId)
    .eq("evidence_type", "phrase_saved")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50);
  const flashcardIds = [...new Set((evidenceRows ?? []).map((r) => r.source_id).filter((id): id is string => Boolean(id)))];
  if (flashcardIds.length === 0) return [];

  const { data: srsRows } = await supabase
    .from("srs_state")
    .select("flashcard_id, repetitions, flashcards!inner(owner_id)")
    .in("flashcard_id", flashcardIds)
    .eq("flashcards.owner_id", userId)
    .lt("repetitions", 3);
  const wordIds = (srsRows ?? []).map((r) => r.flashcard_id as string).slice(0, 5);
  if (wordIds.length === 0) return [];

  const latestOccurredAt = evidenceRows?.[0]?.occurred_at ?? new Date().toISOString();
  return [
    {
      missionType: "phrase_activation",
      sourcePatternId: null,
      sourceRecommendationId: null,
      skillCategory: null,
      severity: wordIds.length >= 3 ? "medium" : "low",
      confidence: "medium",
      trend: "flat",
      evidenceCount: wordIds.length,
      updatedAt: latestOccurredAt,
      title: "Сохранённые фразы",
      reasonKey: "phrase_activation",
      wordIds,
    },
  ];
}

// M3 Slice 10 (task #279): fallback vocab_activation source, only used when no activation_gap
// language_error_pattern already covers this (see the caller above) — familiar words came from
// real recognition-tier evidence (Cards/Choice/Match, state-engine.ts), so pushing one toward a
// genuine typed-recall success via a mission is exactly the same "close the gap" idea
// activation_gap already expresses, just sourced directly from learning_state instead of a
// reading-tap intersection.
async function fetchFamiliarVocabCandidate(
  supabase: SupabaseServerClient,
  userId: string,
  language: string,
): Promise<MissionCandidateInput[]> {
  const { data: rows } = await supabase
    .from("flashcards")
    .select("id, learning_state_updated_at")
    .eq("owner_id", userId)
    .eq("language", language)
    .eq("learning_state", "familiar")
    .order("learning_state_updated_at", { ascending: false, nullsFirst: false })
    .limit(5);
  const wordIds = (rows ?? []).map((r) => r.id);
  if (wordIds.length === 0) return [];

  const latestUpdatedAt = rows?.[0]?.learning_state_updated_at ?? new Date().toISOString();
  return [
    {
      missionType: "vocab_activation",
      sourcePatternId: null,
      sourceRecommendationId: null,
      // Learning Paths' topic/vocabulary skills are tagged category:"activation" (no dedicated
      // vocabulary category exists — plan doc §5) and find their "Практиковать" CTA target via
      // findMatchingMissionForSkill()'s skill_category match (mission-match.ts). Setting this to
      // "activation" — same as the pattern-derived candidate above — is what makes this fallback
      // actually reachable from a topic skill page, not just from Missions itself.
      skillCategory: "activation",
      severity: wordIds.length >= 3 ? "medium" : "low",
      confidence: "medium",
      trend: "flat",
      evidenceCount: wordIds.length,
      updatedAt: latestUpdatedAt,
      title: "Слова почти закреплены",
      reasonKey: "familiar_vocab_ready",
      wordIds,
    },
  ];
}

export async function fetchMissionHistory(supabase: SupabaseServerClient, userId: string): Promise<MissionHistoryEntry[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("missions")
    .select("fingerprint, status, completed_at, dismissed_at")
    .eq("user_id", userId)
    .gte("generated_at", since);
  return (data ?? []).map((row) => ({
    fingerprint: row.fingerprint,
    status: row.status,
    completedAt: row.completed_at,
    dismissedAt: row.dismissed_at,
  }));
}
