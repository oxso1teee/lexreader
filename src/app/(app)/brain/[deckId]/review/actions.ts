"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { touchStreak } from "@/lib/streak";
import { reviewSrsState } from "@/lib/srs";
import { computeFsrsShadowSafe, isFsrsEnabled, isMissingFsrsColumnsError } from "@/lib/fsrs";
import { getSrsParams, getSrsSettings } from "@/lib/srs-settings";
import { saveVocabularyItem, type UpsertWordResult } from "@/lib/vocabulary";
import { checkAndAwardAchievements } from "@/lib/achievements-actions";
import { addXp } from "@/lib/xp-actions";

export async function reviewWord(flashcardId: string, grade: 0 | 1 | 2 | 3) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован.");

  // Отдельные строковые литералы (не конкатенация) — Supabase-js выводит
  // форму строки из литерального типа select(), конкатенация через `+`
  // расширяет тип до `string` и ломает вывод типов до GenericStringError.
  const LEGACY_SELECT =
    "ease_factor, interval_days, repetitions, first_reviewed_at, due_at, last_reviewed_at, flashcards!inner(language)" as const;
  const FSRS_SELECT =
    "ease_factor, interval_days, repetitions, first_reviewed_at, due_at, last_reviewed_at, fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_lapses, fsrs_reps, fsrs_scheduled_days, flashcards!inner(language)" as const;

  const [{ data: fetched, error: fetchError }, params, settings] = await Promise.all([
    supabase.from("srs_state").select(FSRS_SELECT).eq("flashcard_id", flashcardId).single(),
    getSrsParams(supabase, user.id),
    getSrsSettings(supabase, user.id),
  ]);

  // Инцидент 2026-08-01: код и migration 0032 могут быть задеплоены раздельно
  // (Production Rollout Phase 1) — если fsrs_*-колонок ещё нет в БД, этот
  // .select() падает с ошибкой PostgREST "42703 undefined_column" для ВСЕГО
  // запроса, а не только для новых полей. Откатываемся на select без FSRS-
  // полей вместо того, чтобы ломать сохранение легаси-оценки.
  let current = fetched;
  let fsrsColumnsAvailable = true;
  if (isMissingFsrsColumnsError(fetchError)) {
    fsrsColumnsAvailable = false;
    const fallback = await supabase
      .from("srs_state")
      .select(LEGACY_SELECT)
      .eq("flashcard_id", flashcardId)
      .single();
    // Легаси-select не содержит fsrs_*-полей — они просто не читаются нигде
    // ниже, пока fsrsColumnsAvailable=false (см. использование current.fsrs_*
    // за условием fsrsColumnsAvailable). Форма отличается только доп.
    // полями, не структурой join'а — безопасно привести к общему типу.
    current = fallback.data as typeof fetched;
    if (fallback.error || !current) throw new Error("Карточка не найдена.");
  } else if (fetchError || !current) {
    throw new Error("Карточка не найдена.");
  }
  const cardLanguage = (
    Array.isArray(current.flashcards) ? current.flashcards[0] : current.flashcards
  ).language;

  const now = new Date();

  // M2 Learning Upgrade (LEARN-004/LEARN-005): считаем ОБА алгоритма на
  // каждом ревью, независимо от FSRS_ENABLED. Legacy SM-2 остаётся
  // авторитетным источником due_at, пока флаг выключен; FSRS считается
  // "в тени" с самого начала — благодаря этому включение флага в будущем
  // не стартует все карточки с нуля (createEmptyCard), а продолжает уже
  // накопленную историю. Когда флаг включён — наоборот, продолжаем
  // обновлять legacy-поля тем же SM-2, чтобы откат флага не встречал
  // карточки с состоянием, замороженным на момент переключения.
  const legacyNext = reviewSrsState(
    {
      easeFactor: current.ease_factor,
      intervalDays: current.interval_days,
      repetitions: current.repetitions,
    },
    grade,
    params,
  );
  const legacyDueAt = new Date(now.getTime() + legacyNext.intervalDays * 86_400_000);

  // FSRS Release Review (Шаг 5) + инцидент 2026-08-01: shadow-расчёт
  // изолирован через computeFsrsShadowSafe (падение вычисления не должно
  // ломать сохранение оценки) И полностью пропускается, если fsrs_*-колонок
  // ещё нет в БД (fsrsColumnsAvailable=false) — тогда current не содержит
  // этих полей вообще. В обоих случаях fsrsResult=null, due_at и review_log
  // однозначно откатываются на legacy-алгоритм, FSRS-поля srs_state в этом
  // ревью просто не читаются/не обновляются.
  const fsrsResult = fsrsColumnsAvailable
    ? computeFsrsShadowSafe(
        {
          fsrsStability: current.fsrs_stability,
          fsrsDifficulty: current.fsrs_difficulty,
          fsrsState: current.fsrs_state,
          fsrsLapses: current.fsrs_lapses,
          fsrsReps: current.fsrs_reps,
          fsrsScheduledDays: current.fsrs_scheduled_days,
          dueAt: current.due_at,
          lastReviewedAt: current.last_reviewed_at,
        },
        grade,
        settings.max_interval_days,
        now,
      )
    : null;

  const fsrsEnabled = isFsrsEnabled();
  const fsrsAuthoritative = fsrsEnabled && fsrsResult !== null;
  const dueAt = fsrsAuthoritative ? new Date(fsrsResult.dueAt) : legacyDueAt;

  // P0-АУДИТ 3.11 (испр. после повторной проверки): раньше "новизна"
  // определялась через repetitions === 0 — но SM-2 сбрасывает repetitions
  // обратно в 0 при оценке "Не помню" даже для давно изученной карточки
  // (src/lib/srs.ts). Это заставляло забытую-и-пересданную карточку снова
  // попадать в пул "новых" и (при успешном повторном ответе) молча
  // перезаписывать первоначальный first_reviewed_at на сегодня — то есть
  // настоящие новые карточки пользователя незаметно "съедались" чужими
  // забытыми карточками. first_reviewed_at пишем один раз и никогда не
  // трогаем повторно — используем именно его (а не repetitions/fsrs_reps)
  // как признак "карточка ещё ни разу не была пройдена".
  const wasNew = current.first_reviewed_at === null;

  const { error: updateError } = await supabase
    .from("srs_state")
    .update({
      ease_factor: legacyNext.easeFactor,
      interval_days: legacyNext.intervalDays,
      repetitions: legacyNext.repetitions,
      ...(fsrsResult
        ? {
            fsrs_stability: fsrsResult.fsrsStability,
            fsrs_difficulty: fsrsResult.fsrsDifficulty,
            fsrs_state: fsrsResult.fsrsState,
            fsrs_lapses: fsrsResult.fsrsLapses,
            fsrs_reps: fsrsResult.fsrsReps,
            fsrs_scheduled_days: fsrsResult.fsrsScheduledDays,
          }
        : {}),
      due_at: dueAt.toISOString(),
      last_reviewed_at: now.toISOString(),
      ...(wasNew ? { first_reviewed_at: now.toISOString() } : {}),
    })
    .eq("flashcard_id", flashcardId);
  if (updateError) throw new Error("Не удалось сохранить ответ.");

  const { error: logError } = await supabase.from("review_log").insert({
    flashcard_id: flashcardId,
    grade,
    ...(fsrsColumnsAvailable
      ? {
          scheduler_type: fsrsAuthoritative ? "fsrs" : "sm2",
          previous_state_json: fsrsResult?.previousState ?? null,
          next_state_json: fsrsResult?.nextState ?? null,
        }
      : {}),
  });
  if (logError) throw new Error("Не удалось сохранить ответ.");

  await touchStreak(supabase, user.id);
  await checkAndAwardAchievements(supabase, user.id, cardLanguage);
  await addXp(supabase, user.id, 1);
  revalidatePath("/brain");
  revalidatePath("/progress");
}

// Из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, "Дополнительно
// найдено"): карточка из Мозга может оказаться слишком простой для полного
// интервального повторения — переносим её в лёгкий режим практики (Тетрадь),
// не удаляя слово целиком.
export async function sendCardToNotebook(front: string, back: string): Promise<UpsertWordResult> {
  const supabase = await createClient();
  const profile = await requireProfile();
  const result = await saveVocabularyItem(supabase, profile.id, {
    textId: null,
    headword: front,
    translation: back,
    contextSentence: null,
    contextTranslation: null,
    language: profile.target_language,
  });
  if (result.ok) revalidatePath("/notebook");
  return result;
}

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 6.2: вызывается один раз
// по завершении сессии, только если счётчик реально побил сохранённый
// рекорд (проверка на клиенте до вызова — здесь просто безусловная запись).
export async function updateReviewBest(count: number): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ review_best_session_count: count }).eq("id", user.id);
}

export async function getCurrentStreak(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("profiles")
    .select("streak_current")
    .eq("id", user.id)
    .single();

  return data?.streak_current ?? 0;
}
