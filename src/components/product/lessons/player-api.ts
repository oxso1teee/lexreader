import type { LessonCompletionDto, LessonSessionDto, StepProgressDto, SubmitAnswerDto } from "@/lib/lessons/dto";
import type { ActionResult } from "@/lib/lessons/errors";
import type { ExerciseResponse, LessonMode } from "@/lib/lessons/types";

// Четыре вызова, которые нужны плееру. В приложении их выполняют серверные
// действия (server-api.ts); галерея /dev/screens подставляет реализацию на
// настоящем service.ts с хранилищем в памяти — тот же код сервиса, без Supabase.
export interface LessonPlayerApi {
  start(pathSlug: string, skillKey: string, mode: LessonMode): Promise<ActionResult<LessonSessionDto>>;
  advance(attemptId: string, stepId: string): Promise<ActionResult<StepProgressDto>>;
  submit(attemptId: string, exerciseId: string, response: ExerciseResponse): Promise<ActionResult<SubmitAnswerDto>>;
  finish(attemptId: string): Promise<ActionResult<LessonCompletionDto>>;
}
