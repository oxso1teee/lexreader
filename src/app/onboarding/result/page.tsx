import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLatestAttempt } from "@/lib/placement/persist";
import { scorePlacement, hasSelfReportConflict } from "@/lib/placement/scoring";
import type { SelfReportedCefr } from "@/lib/placement/types";
import ResultView from "./result-view";

// docs/moments/ROADMAP.md, этап 7 — Placement-result. Терминальное
// действие онбординга больше не записывает в Learning Path (это раньше
// делал confirmPathAction, удалён вместе со старым recommendPathFromPlacement-
// вызовом здесь) — /learning-paths полностью самодостаточна (своя
// рекомендация в getCatalogAction) и достижима позже из /library, так что
// редирект в активный Enrollment здесь больше не нужен: онбординг всегда
// продолжается на /onboarding/goal, пока не завершён (completed_first_win).
export default async function ResultPage() {
  const profile = await requireProfile();
  if (profile.completed_first_win) redirect("/home");

  const supabase = await createClient();
  const attempt = await getLatestAttempt(supabase, profile.id);
  if (!attempt || attempt.status === "in_progress") redirect("/onboarding/placement");

  const selfReportedCefr = attempt.self_reported_level_at_attempt as SelfReportedCefr | null;
  const isSkipped = attempt.status === "skipped";
  const result = isSkipped ? null : scorePlacement(attempt.answers_json, selfReportedCefr);
  const conflict = result ? hasSelfReportConflict(result.range, selfReportedCefr) : false;

  return (
    <ResultView
      isSkipped={isSkipped}
      result={result}
      hasConflict={conflict}
      selfReportedCefr={selfReportedCefr}
    />
  );
}
