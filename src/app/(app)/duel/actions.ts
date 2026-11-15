"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cachedTranslate } from "@/lib/translate-request";
import {
  pickNextDuelWord,
  pickDistractorWords,
  buildDuelRoundContent,
  describeDuelError,
  DEFAULT_DUEL_ROUND_COUNT,
  type DuelClaimResult,
} from "@/lib/duel";
import { addXp } from "@/lib/xp-actions";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Живые дуэли по словарю 1 на 1". Только два действия идут через Server
// Action вместо прямого вызова RPC из браузерного клиента:
//   - createDuelAction — чтобы сразу же redirect() на созданную дуэль;
//   - dealNextDuelRoundAction — единственное место, которому реально нужен
//     сервер: cachedTranslate() (fetch к MyMemory + service_role запись в
//     translations_cache, PR #41/42), недоступно из чистого SQL и из
//     браузера напрямую. Всё остальное (join/answer/state) — обычные RPC,
//     уже безопасные при прямом вызове по конструкции (см. миграцию) —
//     duel-room.tsx вызывает их через src/lib/supabase/client напрямую,
//     без лишнего хопа через Next.js.

export async function createDuelAction(): Promise<void> {
  const supabase = await createClient();
  const { data: duelId, error } = await supabase.rpc("create_duel", { p_round_count: DEFAULT_DUEL_ROUND_COUNT });
  if (error || !duelId) {
    // Раздел C, Тир 3 — единственный ожидаемый провал здесь: изучаемый
    // язык не 'en' (NGSL/дуэли English-only, тот же констрейнт, что и у
    // стартовых колод). Честно ведём на страницу с объяснением вместо
    // тихого редиректа в никуда.
    redirect(`/duel?error=${encodeURIComponent(describeDuelError(error?.message))}`);
  }
  redirect(`/duel/${duelId}`);
}

export interface DealRoundResult {
  ok: boolean;
  error?: string;
}

// Раздел C, Тир 3 — "слова должны быть одинаково доступны обоим игрокам и
// честны для сравнения... тот же NGSL-датасет из PR #39". Перевод — в
// duels.native_language создателя дуэли (одна и та же цель перевода для
// обоих игроков в рамках одной дуэли, даже если их личные родные языки
// в профиле различаются — см. комментарий у native_language в миграции).
export async function dealNextDuelRoundAction(duelId: string): Promise<DealRoundResult> {
  const supabase = await createClient();
  const { data: duel } = await supabase
    .from("duels")
    .select("status, current_round_index, round_count, language, native_language")
    .eq("id", duelId)
    .maybeSingle();
  if (!duel) return { ok: false, error: describeDuelError("duel_not_found") };
  if (duel.status !== "active") return { ok: false, error: describeDuelError("duel_not_active") };
  if (duel.current_round_index >= duel.round_count) return { ok: true }; // уже сдан последний раунд — идемпотентный no-op

  // Простая, осознанная упрощённая версия для MVP: слова не отслеживаются
  // явно по всей истории дуэли (2809-словный пул, ~7 раундов — шанс
  // случайного повтора внутри одной дуэли пренебрежимо мал, а повтор не
  // ломает честность игры — оба видят один и тот же вопрос симметрично).
  const word = pickNextDuelWord(new Set());
  if (!word) return { ok: false, error: "Не удалось подобрать слово." };
  const distractorWords = pickDistractorWords(new Set([word]), 3);
  if (distractorWords.length < 2) return { ok: false, error: "Недостаточно слов для вариантов ответа." };

  const [correctTranslation, ...distractorTranslations] = await Promise.all([
    cachedTranslate(supabase, word, duel.language, duel.native_language),
    ...distractorWords.map((w) => cachedTranslate(supabase, w, duel.language, duel.native_language)),
  ]);

  const content = buildDuelRoundContent(word, correctTranslation, distractorTranslations);
  const { error } = await supabase.rpc("deal_duel_round", {
    p_duel_id: duelId,
    p_round_index: duel.current_round_index + 1,
    p_word: content.word,
    p_correct_answer: content.correctAnswer,
    p_options: content.options,
  });
  if (error) return { ok: false, error: describeDuelError(error.message) };
  return { ok: true };
}

export interface ClaimDuelResultResponse {
  ok: boolean;
  error?: string;
  result?: DuelClaimResult;
}

// docs/moments/ROADMAP.md, этап 6 — Duel-won. claim_duel_result()
// (0055_duels_rewards_and_friend_streaks.sql) считает win-streak/
// speed-margin и защищает от повторного начисления, но само начисление XP
// живёт в TS (addXp — activity_days/Double-XP boost, не переносим это в
// SQL). Идемпотентна: второй вызов после уже выданного XP вернёт
// xpToAward: 0 из RPC, addXp просто не вызывается повторно.
export async function claimDuelResultAction(duelId: string): Promise<ClaimDuelResultResponse> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: describeDuelError("not_a_participant") };

  const { data, error } = await supabase.rpc("claim_duel_result", { p_duel_id: duelId });
  if (error || !data) return { ok: false, error: describeDuelError(error?.message) };

  const raw = data as { xpToAward: number; winStreak: number; speedMarginSec: number; scoreMe: number; scoreOpponent: number };
  let xpAwarded = 0;
  if (raw.xpToAward > 0) {
    const xpResult = await addXp(supabase, user.user.id, raw.xpToAward);
    xpAwarded = xpResult?.awarded ?? 0;
  }

  return {
    ok: true,
    result: {
      xpToAward: xpAwarded,
      winStreak: raw.winStreak,
      speedMarginSec: raw.speedMarginSec,
      scoreMe: raw.scoreMe,
      scoreOpponent: raw.scoreOpponent,
    },
  };
}
