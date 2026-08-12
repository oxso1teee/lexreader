import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { ConfidenceLevel, PatternCategory } from "@/lib/language-twin/types";

// M3 Slice 8 Phase C — a Skill's `category` field IS the skill_key ->
// PatternCategory mapping (plan doc §5): no separate mapping table needed,
// the curriculum data itself carries it. This is the one place that turns
// that category into a real Language Twin signal for the Skill Detail
// screen — never fabricates a confidence value for a skill with
// category === null.
export interface SkillLanguageTwinSignal {
  confidence: ConfidenceLevel;
  evidenceCount: number;
  patternTitle: string;
}

export async function getSkillLanguageTwinSignal(
  supabase: SupabaseServerClient,
  userId: string,
  category: PatternCategory | null,
): Promise<SkillLanguageTwinSignal | null> {
  if (!category) return null;
  const { data } = await supabase
    .from("language_error_patterns")
    .select("confidence, evidence_count, title")
    .eq("user_id", userId)
    .eq("category", category)
    .order("evidence_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { confidence: data.confidence, evidenceCount: data.evidence_count, patternTitle: data.title };
}
