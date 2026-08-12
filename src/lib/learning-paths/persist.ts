import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { EnrollmentRow, PathSlug, SkillProgressRow } from "./types.ts";
import { emptySkillProgress } from "./progress-engine.ts";
import { getPath } from "./curriculum/index.ts";

// M3 Slice 8 Phase B — the DB-touching half of the enrollment/progress
// engine (mirrors missions/persist.ts's split from the pure logic in
// progress-engine.ts). Every function here trusts its caller (the server
// actions in src/app/(app)/learning-paths/actions.ts) to have already
// resolved `userId` from a real session — RLS is the backstop, not the only
// line of defense (plan doc §13).

export async function getEnrollments(supabase: SupabaseServerClient, userId: string): Promise<EnrollmentRow[]> {
  const { data } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false });
  return (data ?? []) as EnrollmentRow[];
}

export async function getActiveEnrollment(supabase: SupabaseServerClient, userId: string): Promise<EnrollmentRow | null> {
  const { data } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as EnrollmentRow | null) ?? null;
}

export async function getEnrollmentForPath(supabase: SupabaseServerClient, userId: string, pathSlug: PathSlug): Promise<EnrollmentRow | null> {
  const { data } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("path_slug", pathSlug)
    .maybeSingle();
  return (data as EnrollmentRow | null) ?? null;
}

// Starts (or resumes) a path as the user's one primary active path (plan doc
// §10). If another path is currently active, it's paused first — never
// deleted, its progress rows are untouched. If the target path already has
// a paused/completed enrollment, it's reactivated in place rather than
// duplicated (the DB's own unique(user_id, path_slug, ...) shape combined
// with this lookup keeps it to one enrollment row per path per user).
export async function startOrResumePath(supabase: SupabaseServerClient, userId: string, pathSlug: PathSlug): Promise<EnrollmentRow> {
  const path = getPath(pathSlug);
  if (!path) throw new Error(`Unknown learning path: ${pathSlug}`);

  const [current, existingForTarget] = await Promise.all([
    getActiveEnrollment(supabase, userId),
    getEnrollmentForPath(supabase, userId, pathSlug),
  ]);

  if (current && current.path_slug !== pathSlug) {
    await supabase.from("learning_path_enrollments").update({ status: "paused" }).eq("id", current.id).eq("user_id", userId);
  }

  const now = new Date().toISOString();
  if (existingForTarget) {
    const { data } = await supabase
      .from("learning_path_enrollments")
      .update({ status: "active", last_activity_at: now })
      .eq("id", existingForTarget.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    return data as EnrollmentRow;
  }

  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .insert({
      user_id: userId,
      path_slug: pathSlug,
      path_version: path.version,
      status: "active",
      current_stage_key: path.stages[0].key,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Не удалось начать путь: ${error.message}`);
  return data as EnrollmentRow;
}

export async function pausePath(supabase: SupabaseServerClient, userId: string, pathSlug: PathSlug): Promise<void> {
  await supabase
    .from("learning_path_enrollments")
    .update({ status: "paused" })
    .eq("user_id", userId)
    .eq("path_slug", pathSlug)
    .eq("status", "active");
}

export async function markPathCompleted(supabase: SupabaseServerClient, userId: string, pathSlug: PathSlug): Promise<void> {
  await supabase
    .from("learning_path_enrollments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("path_slug", pathSlug)
    .eq("status", "active");
}

export async function touchEnrollmentActivity(supabase: SupabaseServerClient, userId: string, pathSlug: PathSlug): Promise<void> {
  await supabase
    .from("learning_path_enrollments")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("path_slug", pathSlug);
}

export async function setCurrentStage(
  supabase: SupabaseServerClient,
  userId: string,
  pathSlug: PathSlug,
  stageKey: string,
  moduleKey: string | null,
): Promise<void> {
  await supabase
    .from("learning_path_enrollments")
    .update({ current_stage_key: stageKey, current_module_key: moduleKey, last_activity_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("path_slug", pathSlug);
}

export async function getSkillProgressForPath(
  supabase: SupabaseServerClient,
  userId: string,
  pathSlug: PathSlug,
  pathVersion: number,
): Promise<SkillProgressRow[]> {
  const { data } = await supabase
    .from("user_skill_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("path_slug", pathSlug)
    .eq("path_version", pathVersion);
  return (data ?? []) as SkillProgressRow[];
}

export async function getSkillProgressRow(
  supabase: SupabaseServerClient,
  userId: string,
  pathSlug: PathSlug,
  pathVersion: number,
  skillKey: string,
): Promise<SkillProgressRow | null> {
  const { data } = await supabase
    .from("user_skill_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("path_slug", pathSlug)
    .eq("path_version", pathVersion)
    .eq("skill_key", skillKey)
    .maybeSingle();
  return (data as SkillProgressRow | null) ?? null;
}

// Read-or-create: every mutation path (lesson completion, Knowledge Check,
// practice evidence) needs a starting row to apply its patch to, and a
// skill's first-ever interaction has no row yet.
export async function getOrCreateSkillProgress(
  supabase: SupabaseServerClient,
  userId: string,
  pathSlug: PathSlug,
  pathVersion: number,
  skillKey: string,
): Promise<SkillProgressRow> {
  const existing = await getSkillProgressRow(supabase, userId, pathSlug, pathVersion, skillKey);
  if (existing) return existing;

  const path = getPath(pathSlug);
  if (!path) throw new Error(`Unknown learning path: ${pathSlug}`);
  const draft = emptySkillProgress(userId, path, skillKey);

  const { data, error } = await supabase.from("user_skill_progress").insert(draft).select("*").single();
  // 23505 = unique_violation: a concurrent request already created this
  // exact row — re-fetch the winner rather than treat it as an error.
  if (error && error.code !== "23505") throw new Error(`Не удалось сохранить прогресс: ${error.message}`);
  if (data) return data as SkillProgressRow;
  const winner = await getSkillProgressRow(supabase, userId, pathSlug, pathVersion, skillKey);
  if (!winner) throw new Error("Не удалось сохранить прогресс.");
  return winner;
}

export interface SkillProgressPatch {
  status?: SkillProgressRow["status"];
  evidence_count?: number;
  confidence?: SkillProgressRow["confidence"];
  content_completed_at?: string | null;
  last_practiced_at?: string | null;
  knowledge_check_best_score?: number | null;
}

export async function applySkillProgressPatch(
  supabase: SupabaseServerClient,
  userId: string,
  progressId: string,
  patch: SkillProgressPatch,
): Promise<SkillProgressRow | null> {
  if (Object.keys(patch).length === 0) return null;
  const { data } = await supabase
    .from("user_skill_progress")
    .update(patch)
    .eq("id", progressId)
    .eq("user_id", userId)
    .select("*")
    .single();
  return (data as SkillProgressRow | null) ?? null;
}
