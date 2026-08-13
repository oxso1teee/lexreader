"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { touchStreak } from "@/lib/streak";
import { reviewSrsState } from "@/lib/srs";
import { computeFsrsShadowSafe, isMissingFsrsColumnsError } from "@/lib/fsrs";
import { getFsrsFlags } from "@/lib/fsrs-flags";
import { getSrsParams, getSrsSettings } from "@/lib/srs-settings";
import { saveVocabularyItem, type UpsertWordResult } from "@/lib/vocabulary";
import { checkAndAwardAchievements } from "@/lib/achievements-actions";
import { addXp } from "@/lib/xp-actions";
import { getOrCreateSettingsSafe } from "@/lib/language-twin/settings";
import { recomputeLanguageTwin } from "@/lib/language-twin/recompute";
import type { PatternCategory, PatternStatus, Trend } from "@/lib/language-twin/types";
import { recomputeAndPersistLearningState } from "@/lib/vocabulary/state-update";
import type { PracticeMode } from "@/lib/vocabulary/state-engine";
import { buildContextGapBlank } from "@/lib/vocabulary/context-gap";

export async function reviewWord(
  flashcardId: string,
  grade: 0 | 1 | 2 | 3,
  mode: PracticeMode = "cards",
): Promise<{ reviewLogId: string | null }> {
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

  const flags = getFsrsFlags(user.id);

  // Generic — не ternary внутри .select() — Supabase-js выводит форму строки
  // из литерального типа аргумента; объединённый (не литеральный) тип из
  // тернарника внутри самого select() ломает парсер до ParserError. Каждый
  // ВЫЗОВ fetchSrsState() ниже получает свой литерал отдельно, а сам выбор
  // между двумя уже готовыми промисами делается тернарником снаружи.
  function fetchSrsState<Select extends string>(select: Select) {
    return supabase.from("srs_state").select(select).eq("flashcard_id", flashcardId).single();
  }

  // FSRS Schema Compatibility Hotfix: flags.shadowEnabled решает ДО отправки
  // запроса, включать ли fsrs_*-колонки — не полагаемся на то, что Supabase
  // их проигнорирует. Если флаг всё же выставлен раньше реальной миграции,
  // 42703 ниже всё равно откатывается на легаси-select (defense in depth,
  // не единственная защита).
  // Тип результата берём с FSRS_SELECT-варианта (referenceQuery ниже не
  // выполняется — только даёт тип для приведения) — при
  // flags.shadowEnabled=false реально уходит легаси-запрос, но runtime-
  // доступ к fsrs_*-полям всё равно защищён условием usedFsrsColumns ниже,
  // так что типовая "ложь" здесь безопасна (тот же приём, что и в fallback-
  // ветке чуть ниже: `as typeof fetched`).
  type FetchedRow = Awaited<ReturnType<typeof fetchSrsState<typeof FSRS_SELECT>>>;
  const [{ data: fetched, error: fetchError }, params, settings] = await Promise.all([
    (flags.shadowEnabled ? fetchSrsState(FSRS_SELECT) : fetchSrsState(LEGACY_SELECT)) as unknown as FetchedRow,
    getSrsParams(supabase, user.id),
    getSrsSettings(supabase, user.id),
  ]);

  let current = fetched;
  let usedFsrsColumns = flags.shadowEnabled;
  if (flags.shadowEnabled && isMissingFsrsColumnsError(fetchError)) {
    usedFsrsColumns = false;
    const fallback = await supabase
      .from("srs_state")
      .select(LEGACY_SELECT)
      .eq("flashcard_id", flashcardId)
      .single();
    // Легаси-select не содержит fsrs_*-полей — они просто не читаются нигде
    // ниже, пока usedFsrsColumns=false. Форма отличается только доп. полями,
    // не структурой join'а — безопасно привести к общему типу.
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

  // FSRS Release Review (Шаг 5) + Schema Compatibility Hotfix: shadow-расчёт
  // изолирован через computeFsrsShadowSafe (падение вычисления не должно
  // ломать сохранение оценки) И полностью пропускается, если select ушёл на
  // легаси (usedFsrsColumns=false) — тогда current не содержит этих полей
  // вообще. В обоих случаях fsrsResult=null, due_at и review_log однозначно
  // откатываются на legacy-алгоритм, FSRS-поля srs_state в этом ревью просто
  // не читаются/не обновляются.
  const fsrsResult = usedFsrsColumns
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

  const fsrsAuthoritative = flags.enabled && fsrsResult !== null;
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

  // M3 Slice 4 §8 (undo last grade, migration 0035): снимок legacy-полей
  // до/после — единственный способ восстановить due_at/ease_factor/
  // interval_days/repetitions/first_reviewed_at для не-FSRS-авторитетных
  // аккаунтов; previous_state_json/next_state_json (0032) хранят только
  // FSRS Card, не legacy-состояние. Пишем всегда, не только при
  // usedFsrsColumns — это не FSRS-специфичные данные.
  const previousLegacyState = {
    ease_factor: current.ease_factor,
    interval_days: current.interval_days,
    repetitions: current.repetitions,
    due_at: current.due_at,
    first_reviewed_at: current.first_reviewed_at,
    last_reviewed_at: current.last_reviewed_at,
  };
  const nextLegacyState = {
    ease_factor: legacyNext.easeFactor,
    interval_days: legacyNext.intervalDays,
    repetitions: legacyNext.repetitions,
    due_at: dueAt.toISOString(),
    first_reviewed_at: wasNew ? now.toISOString() : current.first_reviewed_at,
    last_reviewed_at: now.toISOString(),
  };

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

  const { data: logRow, error: logError } = await supabase
    .from("review_log")
    .insert({
      flashcard_id: flashcardId,
      grade,
      practice_mode: mode,
      previous_legacy_state_json: previousLegacyState,
      next_legacy_state_json: nextLegacyState,
      ...(usedFsrsColumns
        ? {
            scheduler_type: fsrsAuthoritative ? "fsrs" : "sm2",
            previous_state_json: fsrsResult?.previousState ?? null,
            next_state_json: fsrsResult?.nextState ?? null,
          }
        : {}),
    })
    .select("id")
    .single();
  if (logError) throw new Error("Не удалось сохранить ответ.");

  await touchStreak(supabase, user.id);
  await checkAndAwardAchievements(supabase, user.id, cardLanguage);
  await addXp(supabase, user.id, 1);
  // M3 Slice 10 (brief §27): the scheduler write above already succeeded and is what matters —
  // this supplemental derived-state recompute must never turn a successful review into a thrown
  // error, so it's a fire-and-forget call into a function that swallows its own failures.
  await recomputeAndPersistLearningState(supabase, flashcardId);
  revalidatePath("/brain");
  revalidatePath("/progress");
  return { reviewLogId: logRow?.id ?? null };
}

// M3 Slice 10 (brief Phase C §14, task #277) — data side of the Context Gap practice mode: given
// the flashcard ids already loaded for this review session, finds which ones have a saved
// vocabulary_contexts sentence where the front word/phrase appears exactly once (see
// buildContextGapBlank — anything ambiguous is simply excluded, never guessed at). Deliberately
// a separate lazy fetch, not part of the CARD_FIELDS select in page.tsx: the other four modes
// never need context text, and eagerly joining it onto every due card would be real, unnecessary
// weight on every review-session load.
export interface ContextGapCard {
  flashcardId: string;
  front: string;
  before: string;
  blanked: string;
  after: string;
  contextTranslation: string | null;
}

export async function getContextGapCards(flashcardIds: string[]): Promise<ContextGapCard[]> {
  if (flashcardIds.length === 0) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: cards }, { data: contexts }] = await Promise.all([
    supabase.from("flashcards").select("id, front").eq("owner_id", user.id).in("id", flashcardIds),
    supabase
      .from("vocabulary_contexts")
      .select("flashcard_id, context_text, context_translation")
      .in("flashcard_id", flashcardIds)
      .order("created_at", { ascending: false }),
  ]);

  const contextsByCard = new Map<string, { context_text: string; context_translation: string | null }[]>();
  for (const c of contexts ?? []) {
    const list = contextsByCard.get(c.flashcard_id) ?? [];
    list.push({ context_text: c.context_text, context_translation: c.context_translation });
    contextsByCard.set(c.flashcard_id, list);
  }

  const result: ContextGapCard[] = [];
  for (const card of cards ?? []) {
    // Most-recently-added context first (same ordering as the Detail page) — if several
    // contexts exist, use the first one that yields an unambiguous blank rather than the oldest.
    for (const ctx of contextsByCard.get(card.id) ?? []) {
      const blank = buildContextGapBlank(card.front, ctx.context_text);
      if (blank) {
        result.push({
          flashcardId: card.id,
          front: card.front,
          before: blank.before,
          blanked: blank.blanked,
          after: blank.after,
          contextTranslation: ctx.context_translation,
        });
        break;
      }
    }
  }
  return result;
}

// M3 Slice 4 §8: отменяет ровно последнюю оценку этой карточки — проверяет
// владение через join на flashcards (та же схема, что и RLS-политика
// "review_log: owner full access"), и что после reviewLogId не появилось
// более новой записи для той же карточки (защита от отмены "не последней"
// оценки и от повторной отмены — после удаления строки повторный вызов с
// тем же id просто не найдёт её). Восстанавливает legacy-поля всегда;
// FSRS-поля — только если previous_state_json реально был записан в этом
// ревью (usedFsrsColumns=true на момент оценки).
export interface UndoResult {
  ok: boolean;
  error?: string;
}

export async function undoLastGrade(reviewLogId: string): Promise<UndoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };

  const { data: logRow, error: fetchError } = await supabase
    .from("review_log")
    .select(
      "id, flashcard_id, previous_legacy_state_json, previous_state_json, flashcards!inner(owner_id)",
    )
    .eq("id", reviewLogId)
    .maybeSingle();
  if (fetchError || !logRow) return { ok: false, error: "Оценка не найдена." };

  const flashcardRow = Array.isArray(logRow.flashcards) ? logRow.flashcards[0] : logRow.flashcards;
  if (!flashcardRow || flashcardRow.owner_id !== user.id) {
    return { ok: false, error: "Нет доступа." };
  }

  const { data: mostRecent } = await supabase
    .from("review_log")
    .select("id")
    .eq("flashcard_id", logRow.flashcard_id)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!mostRecent || mostRecent.id !== reviewLogId) {
    return { ok: false, error: "Уже есть более новая оценка — отменить нельзя." };
  }

  if (!logRow.previous_legacy_state_json) {
    return { ok: false, error: "Для этой оценки нет сохранённого состояния — отменить нельзя." };
  }
  const prevLegacy = logRow.previous_legacy_state_json as {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    due_at: string;
    first_reviewed_at: string | null;
    last_reviewed_at: string | null;
  };
  const prevFsrs = logRow.previous_state_json as {
    stability: number;
    difficulty: number;
    state: number;
    lapses: number;
    reps: number;
    scheduled_days: number;
  } | null;

  const { error: restoreError } = await supabase
    .from("srs_state")
    .update({
      ease_factor: prevLegacy.ease_factor,
      interval_days: prevLegacy.interval_days,
      repetitions: prevLegacy.repetitions,
      due_at: prevLegacy.due_at,
      first_reviewed_at: prevLegacy.first_reviewed_at,
      last_reviewed_at: prevLegacy.last_reviewed_at,
      ...(prevFsrs
        ? {
            fsrs_stability: prevFsrs.stability,
            fsrs_difficulty: prevFsrs.difficulty,
            fsrs_state: prevFsrs.state,
            fsrs_lapses: prevFsrs.lapses,
            fsrs_reps: prevFsrs.reps,
            fsrs_scheduled_days: prevFsrs.scheduled_days,
          }
        : {}),
    })
    .eq("flashcard_id", logRow.flashcard_id);
  if (restoreError) return { ok: false, error: "Не удалось восстановить состояние." };

  const { error: deleteError } = await supabase.from("review_log").delete().eq("id", reviewLogId);
  if (deleteError) return { ok: false, error: "Не удалось удалить запись." };

  revalidatePath("/brain");
  revalidatePath("/progress");
  return { ok: true };
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

export interface LanguageTwinSessionUpdate {
  patternTitle: string;
  category: PatternCategory;
  status: PatternStatus;
  trend: Trend;
}

// Called once from SessionComplete, mirroring getCurrentStreak below — a
// review session is exactly the kind of real signal review_recall/
// activation patterns are computed from (see recompute.ts), so this forces
// an immediate recompute (same staleness-bypass reasoning as the manual
// "Recompute" button and saveCorrectionEvidenceAction) and surfaces
// whichever review/activation pattern most recently changed. Returns null
// rather than fabricating a stat when there's nothing genuine to show.
export async function getLanguageTwinUpdateAction(): Promise<LanguageTwinSessionUpdate | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getOrCreateSettingsSafe(supabase, user.id);
  if (!settings || !settings.enabled) return null;

  const { data: profile } = await supabase.from("profiles").select("target_language").eq("id", user.id).single();
  if (!profile) return null;

  await recomputeLanguageTwin(supabase, user.id, profile.target_language);

  const { data: patterns } = await supabase
    .from("language_error_patterns")
    .select("title, category, status, trend")
    .eq("user_id", user.id)
    .in("category", ["activation", "review_recall"])
    .in("status", ["active", "improving"])
    .order("updated_at", { ascending: false })
    .limit(1);

  const top = patterns?.[0];
  if (!top) return null;
  return { patternTitle: top.title, category: top.category, status: top.status, trend: top.trend };
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
