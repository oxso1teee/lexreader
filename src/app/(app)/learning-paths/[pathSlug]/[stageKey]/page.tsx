import { notFound } from "next/navigation";
import UnitView from "@/components/product/learning-paths/unit-view";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { pathHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";
import LearningPathsSubHeader from "../../sub-header";
import LearningPathsViewTracker from "../../analytics";
import { getStageStateAction } from "../../actions";

// Раздел курса (макет Unit-overview): прогресс раздела и цепочка уроков по
// модулям — пройденные, текущий и закрытые. Состояния — из buildPathMap.
export default async function LearningPathUnitPage({ params }: { params: Promise<{ pathSlug: string; stageKey: string }> }) {
  const { pathSlug: slugParam, stageKey } = await params;
  const path = getPath(slugParam as PathSlug);
  if (!path) notFound();

  const state = await getStageStateAction(path.slug, stageKey);
  if (!state) notFound();
  const { unit, map, enrollment } = state;

  return (
    <UnitView
      path={path}
      unit={unit}
      nextUnit={map.units[unit.number] ?? null}
      enrollmentStatus={enrollment?.status ?? null}
      analytics={<LearningPathsViewTracker event="stage_opened" props={{ path_slug: path.slug, stage_key: unit.key }} />}
      header={
        <LearningPathsSubHeader
          title={`Раздел ${unit.number}`}
          description={`${path.title} · ${path.levelFrom} → ${path.levelTo}`}
          backHref={pathHref(path.slug)}
          backLabel="Программа курса"
        />
      }
    />
  );
}
