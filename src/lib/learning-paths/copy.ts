import { pluralRu } from "../plural-ru.ts";
import type { PathMap } from "./path-map.ts";

// Короткие подписи карты пути. Вынесены из компонентов, чтобы склонения и
// правила («Начать» или «Продолжить») проверялись тестами, а не глазами.

// После «из N» существительное стоит в родительном падеже: «из 1 урока»,
// «из 2 уроков», «из 21 урока».
const ofLessons = (n: number) => pluralRu(n, "урока", "уроков", "уроков");
const ofUnits = (n: number) => pluralRu(n, "раздела", "разделов", "разделов");

export function lessonsCount(n: number): string {
  return `${n} ${pluralRu(n, "урок", "урока", "уроков")}`;
}

export function unitsCount(n: number): string {
  return `${n} ${pluralRu(n, "раздел", "раздела", "разделов")}`;
}

export function modulesCount(n: number): string {
  return `${n} ${pluralRu(n, "модуль", "модуля", "модулей")}`;
}

/** «3 из 9 уроков». */
export function doneOfLessons(done: number, total: number): string {
  return `${done} из ${total} ${ofLessons(total)}`;
}

/** «2 из 5 разделов · 19 из 47 уроков». */
export function pathProgressLine(map: Pick<PathMap, "doneUnits" | "totalUnits" | "doneLessons" | "totalLessons">): string {
  return `${map.doneUnits} из ${map.totalUnits} ${ofUnits(map.totalUnits)} · ${doneOfLessons(map.doneLessons, map.totalLessons)}`;
}

/** Подпись главной кнопки: пока ничего не пройдено — «Начать». */
export function nextStepLabel(started: boolean): string {
  return started ? "Продолжить" : "Начать";
}

export function opensAfterLesson(title: string): string {
  return `Откроется после урока «${title}»`;
}

export function opensAfterUnit(number: number): string {
  return `Откроется после раздела ${number}`;
}

/** «Урок 3 из 5». */
export function lessonPosition(position: number, size: number): string {
  return `Урок ${position} из ${size}`;
}
