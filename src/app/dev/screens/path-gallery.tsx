import { Check } from "lucide-react";
import LearningPathsSubHeader from "@/app/(app)/learning-paths/sub-header";
import AppShell from "@/components/product/app-shell/app-shell";
import CatalogView from "@/components/product/learning-paths/catalog-view";
import LessonView, { lessonSubtitle } from "@/components/product/learning-paths/lesson-view";
import PathView from "@/components/product/learning-paths/path-view";
import UnitView from "@/components/product/learning-paths/unit-view";
import { buttonClassName } from "@/components/ui/button";
import { getAllSkills } from "@/lib/learning-paths/curriculum/index.ts";
import { PATHS_ALL_HREF, pathHref, unitHref } from "@/lib/learning-paths/routes";
import {
  CATALOG_FIXTURE,
  CATALOG_NEW_FIXTURE,
  LESSON_CURRENT_FIXTURE,
  LESSON_DONE_FIXTURE,
  LESSON_LOCKED_FIXTURE,
  PATH_DONE_FIXTURE,
  PATH_INTRO_FIXTURE,
  PATH_MID_FIXTURE,
  PATH_NEW_FIXTURE,
  PATH_PAUSED_FIXTURE,
  midUnit,
  type LessonFixture,
  type PathFixture,
} from "@/lib/path-fixtures";

// Учебный путь на тестовых данных (Phase 2, WP5) — для скриншот-сверки с
// макетами Curriculum / Unit-overview и проверки состояний в обеих темах.
// Те же PathView / UnitView / LessonView, что на боевых страницах, внутри
// настоящей оболочки (сайдбар от md, таббар на телефоне); клиентские кнопки
// с серверными действиями заменены разметкой с теми же классами.
export const PATH_SCREENS = [
  "Curriculum",
  "Curriculum-new",
  "Curriculum-intro",
  "Curriculum-paused",
  "Curriculum-done",
  "Unit-overview",
  "Unit-locked",
  "Unit-finished",
  "Lesson-current",
  "Lesson-done",
  "Lesson-locked",
  "Course-pick",
  "Course-pick-new",
] as const;
export type PathScreen = (typeof PATH_SCREENS)[number];

export function isPathScreen(s: string | undefined): s is PathScreen {
  return (PATH_SCREENS as readonly string[]).includes(s ?? "");
}

const FIXTURE_BY_SCREEN: Partial<Record<PathScreen, PathFixture>> = {
  Curriculum: PATH_MID_FIXTURE,
  "Curriculum-new": PATH_NEW_FIXTURE,
  "Curriculum-intro": PATH_INTRO_FIXTURE,
  "Curriculum-paused": PATH_PAUSED_FIXTURE,
  "Curriculum-done": PATH_DONE_FIXTURE,
};

function fakeButton(label: string, className?: string) {
  return (
    <button type="button" className={buttonClassName({ variant: "leaf", className })}>
      {label}
    </button>
  );
}

function PathScreenBody({ s }: { s: PathScreen }) {
  const fixture = FIXTURE_BY_SCREEN[s];
  if (fixture) {
    const { path, map, enrollmentStatus } = fixture;
    return (
      <PathView
        path={path}
        map={map}
        enrollmentStatus={enrollmentStatus}
        header={
          <LearningPathsSubHeader
            title={path.title}
            description={enrollmentStatus === null ? undefined : path.goal}
            backHref={PATHS_ALL_HREF}
            backLabel="Все пути"
          />
        }
        startAction={fakeButton("Начать путь", "lp-hero-cta")}
        resumeAction={fakeButton("Продолжить путь")}
        footer={
          enrollmentStatus === "active" ? (
            <button type="button" className={buttonClassName({ variant: "ghost", size: "sm", className: "self-start" })}>
              Поставить на паузу
            </button>
          ) : null
        }
      />
    );
  }

  if (s === "Unit-overview" || s === "Unit-locked" || s === "Unit-finished") {
    const { path, map } = PATH_MID_FIXTURE;
    const unit = midUnit(s === "Unit-overview" ? 2 : s === "Unit-locked" ? 3 : 1);
    return (
      <UnitView
        path={path}
        unit={unit}
        nextUnit={map.units[unit.number] ?? null}
        enrollmentStatus="active"
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

  if (s === "Lesson-current" || s === "Lesson-done" || s === "Lesson-locked") {
    const lesson: LessonFixture =
      s === "Lesson-current" ? LESSON_CURRENT_FIXTURE : s === "Lesson-done" ? LESSON_DONE_FIXTURE : LESSON_LOCKED_FIXTURE;
    const { path } = PATH_MID_FIXTURE;
    const skill = getAllSkills(path).find((candidate) => candidate.key === lesson.skillKey)!;
    const done = lesson.context.lesson.state === "done";
    return (
      <LessonView
        pathSlug={path.slug}
        skill={skill}
        progress={lesson.progress}
        context={lesson.context}
        languageTwinSignal={null}
        matchingMissionId={null}
        hasKnowledgeCheck={skill.category !== null}
        header={
          <LearningPathsSubHeader
            title={skill.title}
            description={lessonSubtitle(lesson.context)}
            backHref={unitHref(path.slug, lesson.context.unit.key)}
            backLabel={lesson.context.unit.title}
          />
        }
        completeAction={
          done ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--leaf-text)]">
              <Check aria-hidden="true" className="h-4 w-4" /> Урок изучен
            </span>
          ) : (
            fakeButton("Отметить как изученное", "self-start")
          )
        }
      />
    );
  }

  const isNew = s === "Course-pick-new";
  return (
    <CatalogView
      entries={isNew ? CATALOG_NEW_FIXTURE : CATALOG_FIXTURE}
      recommendation={
        isNew
          ? { pathSlug: "a2-b1", reason: "Твой уровень по тесту — A2–B1: начни с грамматики по порядку.", lowConfidence: false }
          : null
      }
      header={
        <LearningPathsSubHeader
          title="Пути обучения"
          description="Структурированные курсы поверх твоего профиля «Мой английский» — грамматика по порядку, а не случайные упражнения."
          backHref={isNew ? "/library" : pathHref("a2-b1")}
          backLabel={isNew ? "К библиотеке" : "К моему пути"}
        />
      }
    />
  );
}

export function PathGalleryScreen({ s }: { s: PathScreen }) {
  return (
    <AppShell planLabel={null}>
      <PathScreenBody s={s} />
    </AppShell>
  );
}
