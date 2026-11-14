import { notFound } from "next/navigation";
import PathView from "@/components/product/learning-paths/path-view";
import { ButtonLink } from "@/components/ui/button";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { PATHS_ALL_HREF } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";
import LearningPathsSubHeader from "../sub-header";
import LearningPathsViewTracker from "../analytics";
import { getPathMapAction } from "../actions";
import { StartPathButton, PausePathButton } from "../path-actions";

// Карта курса (макет Curriculum, Phase 2 WP5): разделы по порядку с состояниями
// «пройден / текущий / закрыт», прогресс курса и следующий шаг. Все состояния
// считает buildPathMap из сохранённого прогресса (user_skill_progress), экран
// только показывает их. Один маршрут — три положения пути: зачислен, на паузе,
// не начат.
export default async function LearningPathPage({ params }: { params: Promise<{ pathSlug: string }> }) {
  const { pathSlug: slugParam } = await params;
  const path = getPath(slugParam as PathSlug);
  if (!path) notFound();

  const state = await getPathMapAction(path.slug);
  if (!state) notFound();
  const { enrollment, otherActivePath, map } = state;
  const status = enrollment?.status ?? null;

  const startEvent = otherActivePath ? "learning_path_switched" : "learning_path_started";

  return (
    <PathView
      path={path}
      map={map}
      enrollmentStatus={status}
      analytics={<LearningPathsViewTracker event="learning_path_opened" props={{ path_slug: path.slug }} />}
      header={
        <LearningPathsSubHeader
          title={path.title}
          description={status === null ? undefined : path.goal}
          backHref={PATHS_ALL_HREF}
          backLabel="Все пути"
        />
      }
      startAction={
        <StartPathButton
          pathSlug={path.slug}
          label="Начать путь"
          switchingFrom={otherActivePath?.title ?? null}
          analyticsEvent={startEvent}
          className="lp-hero-cta"
        />
      }
      resumeAction={
        <StartPathButton
          pathSlug={path.slug}
          label="Продолжить путь"
          switchingFrom={otherActivePath?.title ?? null}
          analyticsEvent={otherActivePath ? "learning_path_switched" : "learning_path_resumed"}
        />
      }
      footer={
        status === "active" ? (
          <PausePathButton pathSlug={path.slug} />
        ) : status === "completed" ? (
          <ButtonLink href={PATHS_ALL_HREF} variant="ghost" size="sm" className="self-start">
            Выбрать другой путь
          </ButtonLink>
        ) : null
      }
    />
  );
}
