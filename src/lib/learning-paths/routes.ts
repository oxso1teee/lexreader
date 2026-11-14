import type { LessonNode } from "./path-map.ts";
import type { PathSlug } from "./types.ts";

// Адреса экранов учебного пути в одном месте: карта, раздел, урок, проверка.
// Раньше каждая страница склеивала строку сама, и ссылка на урок из другого
// раздела требовала знать его раздел — теперь он есть в самом уроке.
export const PATHS_CATALOG_HREF = "/learning-paths";

/** Каталог путей даже при активном пути (иначе / открывает карту активного). */
export const PATHS_ALL_HREF = "/learning-paths?all=1";

export function pathHref(slug: PathSlug): string {
  return `/learning-paths/${slug}`;
}

export function unitHref(slug: PathSlug, unitKey: string): string {
  return `/learning-paths/${slug}/${unitKey}`;
}

export function lessonHref(slug: PathSlug, lesson: Pick<LessonNode, "unitKey" | "key">): string {
  return `/learning-paths/${slug}/${lesson.unitKey}/${lesson.key}`;
}

export function checkHref(slug: PathSlug, lesson: Pick<LessonNode, "unitKey" | "key">): string {
  return `${lessonHref(slug, lesson)}/check`;
}
