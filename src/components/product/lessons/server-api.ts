import {
  advanceStepAction,
  finishLessonAction,
  startLessonAction,
  submitAnswerAction,
} from "@/app/(app)/learning-paths/lesson-session-actions";
import type { LessonPlayerApi } from "./player-api";

/** Боевая реализация: серверные действия. */
export const serverLessonApi: LessonPlayerApi = {
  start: startLessonAction,
  advance: advanceStepAction,
  submit: submitAnswerAction,
  finish: finishLessonAction,
};
