// Каталог источников XP — единственное место, где определено «за что и сколько».
// Каждое начисление в приложении идёт через awardXp() (award.ts) с одним из этих
// источников; сумма либо фиксирована здесь, либо вычисляется сервером и
// проверяется по потолку. Клиент размер награды не задаёт никогда.
//
// Правила источника:
//   amount      — фиксированная награда (если не задана — её считает серверный
//                 код, например баллы урока, и она проверяется по maxAmount);
//   requiresRef — начисление привязано к уникальному событию (id попытки,
//                 строки журнала повторений, даты…): тот же ref второй раз не
//                 начисляется — идемпотентность на уровне БД (xp_events);
//   dailyCap    — потолок «базового» XP источника за локальный день: защита от
//                 накрутки там, где событие повторяемо по природе.

import { LESSON_BASE_XP, LESSON_PERFECT_BONUS_XP } from "../lessons/xp-rules.ts";
import { COMBO_SIZE, PERFECT_MIN_CARDS, SESSION_GAP_MS } from "./review-bonuses.ts";

export type XpSourceId =
  | "lesson_complete"
  | "review_card"
  | "combo_bonus"
  | "perfect_session"
  | "reading_session"
  | "word_saved"
  | "duel_win"
  | "quest_chest"
  | "perfect_week";

export type XpSourceGroup = "learning" | "reading" | "vocabulary" | "bonus";

export interface XpSourceDef {
  id: XpSourceId;
  /** Название строки в истории XP. */
  label: string;
  /** Правило словами — для экрана «За что даётся XP». */
  rule: string;
  group: XpSourceGroup;
  amount?: number;
  maxAmount: number;
  requiresRef: boolean;
  dailyCap?: number;
}

export const XP_SOURCES: Readonly<Record<XpSourceId, XpSourceDef>> = {
  lesson_complete: {
    id: "lesson_complete",
    label: "Урок пройден",
    rule: `${LESSON_BASE_XP} XP за урок, +${LESSON_PERFECT_BONUS_XP} за урок без ошибок. Один раз на урок.`,
    group: "learning",
    // потолок = лучший возможный урок; размер считает сервер (lessons/xp-rules.ts)
    maxAmount: LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP,
    requiresRef: true,
  },
  review_card: {
    id: "review_card",
    label: "Повторение слова",
    rule: "1 XP за каждую оценённую карточку.",
    group: "vocabulary",
    amount: 1,
    maxAmount: 1,
    requiresRef: true,
    dailyCap: 300,
  },
  combo_bonus: {
    id: "combo_bonus",
    label: "Серия верных ответов",
    rule: `+5 XP за каждые ${COMBO_SIZE} верных ответов подряд в одной сессии (пауза между карточками — не дольше ${SESSION_GAP_MS / 60_000} мин).`,
    group: "bonus",
    amount: 5,
    maxAmount: 5,
    requiresRef: true,
    dailyCap: 60,
  },
  perfect_session: {
    id: "perfect_session",
    label: "Идеальная сессия",
    rule: `+10 XP за сессию повторения без ошибок (от ${PERFECT_MIN_CARDS} карточек; пауза между карточками — не дольше ${SESSION_GAP_MS / 60_000} мин). Один раз за сессию.`,
    group: "bonus",
    amount: 10,
    maxAmount: 10,
    requiresRef: true,
    dailyCap: 30,
  },
  reading_session: {
    id: "reading_session",
    label: "Чтение",
    rule: "10 XP за чтение текста. Один раз на текст в день.",
    group: "reading",
    amount: 10,
    maxAmount: 10,
    requiresRef: true,
    dailyCap: 60,
  },
  word_saved: {
    id: "word_saved",
    label: "Новое слово",
    rule: "2 XP за каждое новое сохранённое слово.",
    group: "vocabulary",
    amount: 2,
    maxAmount: 2,
    requiresRef: true,
    dailyCap: 100,
  },
  duel_win: {
    id: "duel_win",
    label: "Победа в дуэли",
    rule: "Награда за победу в дуэли слов. Один раз на дуэль.",
    group: "bonus",
    maxAmount: 100,
    requiresRef: true,
  },
  quest_chest: {
    id: "quest_chest",
    label: "Сундук дня",
    rule: "+30 XP за выполнение всех заданий дня. Один раз в день.",
    group: "bonus",
    amount: 30,
    maxAmount: 30,
    requiresRef: true,
  },
  perfect_week: {
    id: "perfect_week",
    label: "Идеальная неделя",
    rule: "+20 XP, если цель дня выполнена все 7 дней недели.",
    group: "bonus",
    amount: 20,
    maxAmount: 20,
    requiresRef: true,
  },
};

export function isXpSource(value: unknown): value is XpSourceId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(XP_SOURCES, value);
}

export const MAX_REF_LENGTH = 200;

/** Подстановка «{day}» заменяется в БД локальным днём пользователя (award_xp). */
export const DAY_REF = "{day}";

export type AwardRejection = "invalid_source" | "invalid_amount" | "ref_required" | "invalid_ref";

export interface AwardRequest {
  source: string;
  ref?: string | null;
  /** Только для источников без фиксированной суммы; для остальных должна совпадать с каталогом или отсутствовать. */
  amount?: number;
}

export type AwardValidation =
  | { ok: true; source: XpSourceDef; ref: string | null; amount: number }
  | { ok: false; reason: AwardRejection };

/** Проверка запроса на начисление по каталогу — до обращения к БД. */
export function validateAward(request: AwardRequest): AwardValidation {
  if (!isXpSource(request.source)) return { ok: false, reason: "invalid_source" };
  const source = XP_SOURCES[request.source];

  let amount: number;
  if (source.amount !== undefined) {
    if (request.amount !== undefined && request.amount !== source.amount) return { ok: false, reason: "invalid_amount" };
    amount = source.amount;
  } else {
    if (typeof request.amount !== "number" || !Number.isInteger(request.amount)) return { ok: false, reason: "invalid_amount" };
    amount = request.amount;
  }
  if (amount < 1 || amount > source.maxAmount) return { ok: false, reason: "invalid_amount" };

  const ref = request.ref ?? null;
  if (ref === null) {
    if (source.requiresRef) return { ok: false, reason: "ref_required" };
  } else if (typeof ref !== "string" || ref.trim().length === 0 || ref.length > MAX_REF_LENGTH) {
    return { ok: false, reason: "invalid_ref" };
  }
  return { ok: true, source, ref, amount };
}

export function sourceLabel(id: string): string {
  return isXpSource(id) ? XP_SOURCES[id].label : "Другое";
}
