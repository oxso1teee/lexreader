"use server";

import { revalidatePath } from "next/cache";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import type { LessonCompletionDto, LessonSessionDto, StepProgressDto, SubmitAnswerDto } from "@/lib/lessons/dto";
import { failure, type ActionResult } from "@/lib/lessons/errors";
import { createLessonContext } from "@/lib/lessons/server";
import { advanceStep, finishSession, startSession, submitAnswer } from "@/lib/lessons/service";
import { captureServerEvent } from "@/lib/posthog-server";

// Серверные действия плеера уроков. Server Action — публичная POST-точка:
// аутентификация и владение проверяются внутри КАЖДОГО вызова (createLessonContext
// берёт пользователя из серверной сессии), от клиента принимаются только id
// попытки/шага/упражнения и сам ответ. Правильные ответы отсюда не уходят —
// только результат проверки уже отправленного ответа.
//
// События аналитики — только закрытые перечисления, числа и флаги (см.
// e2e/learning-paths-privacy.spec.ts): ни текстов заданий, ни ответов.

function revalidateAfterLesson() {
  revalidatePath("/learning-paths");
  revalidatePath("/home");
  revalidatePath("/progress");
  revalidatePath("/library");
  revalidatePath("/language-twin");
}

export async function startLessonAction(pathSlug: string, skillKey: string, mode: string): Promise<ActionResult<LessonSessionDto>> {
  if (typeof pathSlug !== "string" || typeof skillKey !== "string") return failure("not_found");
  if (mode !== "lesson" && mode !== "check") return failure("not_found");
  const path = getPath(pathSlug);
  if (!path) return failure("not_found");
  const context = await createLessonContext();
  if (!context.ok) return failure(context.code);

  const result = await startSession(context.context.deps, { pathSlug: path.slug, pathVersion: path.version, skillKey }, mode);
  if (result.ok && !result.data.resumed) {
    captureServerEvent(context.context.userId, "lesson_started", { path_slug: path.slug, skill_key: skillKey, mode: result.data.mode });
  }
  return result;
}

export async function advanceStepAction(attemptId: string, stepId: string): Promise<ActionResult<StepProgressDto>> {
  const context = await createLessonContext();
  if (!context.ok) return failure(context.code);
  return advanceStep(context.context.deps, attemptId, stepId);
}

export async function submitAnswerAction(attemptId: string, exerciseId: string, response: unknown): Promise<ActionResult<SubmitAnswerDto>> {
  const context = await createLessonContext();
  if (!context.ok) return failure(context.code);
  return submitAnswer(context.context.deps, attemptId, exerciseId, response);
}

export async function finishLessonAction(attemptId: string): Promise<ActionResult<LessonCompletionDto>> {
  const context = await createLessonContext();
  if (!context.ok) return failure(context.code);
  const { userId, deps } = context.context;

  const result = await finishSession(deps, attemptId);
  if (!result.ok) return result;
  const dto = result.data;

  // Побочные эффекты — только у вызова, который применил итоги попытки:
  // повторное открытие экрана результата не шлёт события и не сбрасывает кэш.
  if (dto.finalizedNow) {
    captureServerEvent(userId, "lesson_attempt_finished", {
      path_slug: dto.pathSlug,
      skill_key: dto.skillKey,
      mode: dto.mode,
      passed: dto.passed,
      correct_count: dto.correctCount,
      incorrect_count: dto.incorrectCount,
    });
    if (dto.mode === "check") {
      captureServerEvent(userId, "knowledge_check_completed", { path_slug: dto.pathSlug, skill_key: dto.skillKey, bucket: dto.bucket });
    }
    if (dto.firstWin) {
      captureServerEvent(userId, "onboarding_first_win_completed", { path_slug: dto.pathSlug, skill_key: dto.skillKey });
      captureServerEvent(userId, "onboarding_completed", { path_slug: dto.pathSlug });
    }
    revalidateAfterLesson();
  }
  // Моменты в dto заполнены только у вызова, применившего итоги (service.ts).
  return result;
}
