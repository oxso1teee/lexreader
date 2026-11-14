import type { SupabaseServerClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog-server";
import type { UnitDoneMoment } from "@/lib/moments/types";
import { buildPathMap } from "./path-map.ts";
import { getSkillProgressForPath, markPathCompleted, setCurrentStage } from "./persist.ts";
import type { LearningPath } from "./types.ts";

// Вызывается после каждого изменения прогресса по уроку: переносит сохранённую
// позицию зачисления (current_stage_key/current_module_key) на следующий урок,
// отдаёт «раздел пройден» и закрывает путь, когда пройден последний урок —
// отдельным действием пользователя это не бывает (plan doc's active CTA rule:
// это учёт, а не то, что обещает кнопка). `newlyCompleted` — этим вызовом урок
// впервые засчитан: события и экран «раздел пройден» повторно не отправляются
// при пересдаче проверки или повторном нажатии.
//
// Раньше жила в learning-paths/actions.ts; вынесена, потому что то же самое
// нужно и ручному завершению урока, и плееру уроков (src/lib/lessons) — одна
// реализация вместо двух.
export async function afterProgressChange(
  supabase: SupabaseServerClient,
  userId: string,
  path: LearningPath,
  skillKey: string,
  newlyCompleted: boolean,
): Promise<UnitDoneMoment | null> {
  const rows = await getSkillProgressForPath(supabase, userId, path.slug, path.version);
  const map = buildPathMap(path, rows);

  const lastUnit = map.units[map.units.length - 1];
  await setCurrentStage(supabase, userId, path.slug, map.next ? map.next.unit.key : lastUnit.key, map.next ? map.next.module.key : null);

  // Закрытие пути идемпотентно (обновляет только active-зачисление), поэтому
  // выполняется и при повторном вызове: если прошлый вызов упал между записью
  // прогресса последнего урока и этим шагом, повтор доведёт путь до конца.
  if (map.complete) await markPathCompleted(supabase, userId, path.slug);

  if (!newlyCompleted) return null;

  let unitDone: UnitDoneMoment | null = null;
  const unit = map.units.find((u) => u.lessons.some((lesson) => lesson.key === skillKey));
  if (unit?.state === "done") {
    captureServerEvent(userId, "stage_completed", { path_slug: path.slug, stage_key: unit.key });
    // docs/moments/ROADMAP.md, этап 4 — Unit-done. Номер раздела и следующий
    // раздел — из реального порядка курса (curriculum, не из БД), тот же
    // массив, что рисует карта пути.
    const nextUnit = map.units[unit.number] ?? null;
    unitDone = {
      kind: "unit_done",
      id: `unit-done-${userId}-${path.slug}-${unit.key}`,
      pathTitle: path.title,
      stageTitle: unit.title,
      stageIndex: unit.number,
      stagesTotal: map.totalUnits,
      skillsInStage: unit.total,
      nextStageTitle: nextUnit?.title ?? null,
    };
  }

  if (map.complete) captureServerEvent(userId, "learning_path_completed", { path_slug: path.slug });

  return unitDone;
}
