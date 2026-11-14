import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_REF_LENGTH, XP_SOURCES, isXpSource, sourceLabel, validateAward } from "./sources.ts";

test("каталог: у каждого источника есть метка, правило, потолок суммы и согласованные поля", () => {
  for (const [id, def] of Object.entries(XP_SOURCES)) {
    assert.equal(def.id, id);
    assert.ok(def.label.length > 0 && def.rule.length > 0, id);
    assert.ok(def.maxAmount >= 1 && def.maxAmount <= 1000, id);
    if (def.amount !== undefined) assert.ok(def.amount >= 1 && def.amount <= def.maxAmount, id);
    if (def.dailyCap !== undefined) assert.ok(def.dailyCap >= (def.amount ?? 1), id);
    assert.match(id, /^[a-z][a-z0-9_]{0,39}$/, "форма совпадает с check в БД");
  }
});

test("каталог: каждый источник привязан к уникальному событию (ref обязателен) — повтор невозможен", () => {
  assert.ok(Object.values(XP_SOURCES).every((s) => s.requiresRef));
});

test("validateAward: фиксированные суммы берутся из каталога; чужая сумма отклоняется", () => {
  const ok = validateAward({ source: "review_card", ref: "log-1" });
  assert.ok(ok.ok && ok.amount === 1 && ok.ref === "log-1");
  assert.deepEqual(validateAward({ source: "review_card", ref: "log-1", amount: 1 }).ok, true);
  assert.deepEqual(validateAward({ source: "review_card", ref: "log-1", amount: 50 }), { ok: false, reason: "invalid_amount" });
  assert.deepEqual(validateAward({ source: "quest_chest", ref: "{day}", amount: 999 }), { ok: false, reason: "invalid_amount" });
});

test("validateAward: сумма, считаемая сервером, обязана быть целой и в пределах потолка", () => {
  assert.ok(validateAward({ source: "lesson_complete", ref: "a1", amount: 20 }).ok);
  assert.ok(validateAward({ source: "lesson_complete", ref: "a1", amount: 15 }).ok);
  for (const amount of [undefined, 0, -5, 21, 26, 1.5, Number.NaN, Infinity, "20" as unknown as number]) {
    assert.deepEqual(validateAward({ source: "lesson_complete", ref: "a1", amount }), { ok: false, reason: "invalid_amount" }, String(amount));
  }
  assert.ok(validateAward({ source: "duel_win", ref: "d1", amount: 25 }).ok);
  assert.equal(validateAward({ source: "duel_win", ref: "d1", amount: 101 }).ok, false);
});

test("validateAward: неизвестный/подставной источник отклоняется (включая ключи прототипа)", () => {
  for (const source of ["", "hack", "REVIEW_CARD", "constructor", "__proto__", "toString", "review_card ", 42 as unknown as string]) {
    assert.deepEqual(validateAward({ source, ref: "x", amount: 1 }), { ok: false, reason: "invalid_source" }, String(source));
  }
  assert.equal(isXpSource("lesson_complete"), true);
  assert.equal(isXpSource("constructor"), false);
});

test("validateAward: ключ обязателен, пустой и слишком длинный — отклоняются", () => {
  assert.deepEqual(validateAward({ source: "lesson_complete", amount: 15 }), { ok: false, reason: "ref_required" });
  assert.deepEqual(validateAward({ source: "lesson_complete", ref: null, amount: 15 }), { ok: false, reason: "ref_required" });
  assert.deepEqual(validateAward({ source: "lesson_complete", ref: "   ", amount: 15 }), { ok: false, reason: "invalid_ref" });
  assert.deepEqual(validateAward({ source: "lesson_complete", ref: "x".repeat(MAX_REF_LENGTH + 1), amount: 15 }), { ok: false, reason: "invalid_ref" });
  assert.ok(validateAward({ source: "lesson_complete", ref: "x".repeat(MAX_REF_LENGTH), amount: 15 }).ok);
});

test("sourceLabel: понятное название, для неизвестного — «Другое»", () => {
  assert.equal(sourceLabel("lesson_complete"), "Урок пройден");
  assert.equal(sourceLabel("legacy_thing"), "Другое");
});

// ---- согласованность правил XP: реализация, каталог и тексты берутся из одного места ----

import { LESSON_BASE_XP, LESSON_PERFECT_BONUS_XP, lessonXp } from "../lessons/xp-rules.ts";
import { COMBO_SIZE, PERFECT_MIN_CARDS, comboBlockRefs, perfectSession } from "./review-bonuses.ts";

test("урок: потолок каталога равен лучшему уроку, а любая награда сервиса проходит проверку каталога", () => {
  assert.equal(XP_SOURCES.lesson_complete.maxAmount, LESSON_BASE_XP + LESSON_PERFECT_BONUS_XP);
  for (const [correct, total] of [[0, 0], [1, 5], [3, 5], [5, 5], [7, 7]] as const) {
    assert.ok(validateAward({ source: "lesson_complete", ref: "a", amount: lessonXp(correct, total) }).ok, `${correct}/${total}`);
  }
  assert.match(XP_SOURCES.lesson_complete.rule, new RegExp(`^${LESSON_BASE_XP} XP за урок, \\+${LESSON_PERFECT_BONUS_XP} за урок без ошибок`));
});

test("урок: 15 XP за зачтённый, +5 за урок без ошибок, итого 20 (значения не менялись с Iteration 5)", () => {
  assert.deepEqual([LESSON_BASE_XP, LESSON_PERFECT_BONUS_XP, lessonXp(4, 5), lessonXp(5, 5)], [15, 5, 15, 20]);
});

test("серия: +5 XP за каждые 5 верных подряд; тексты правил читают те же COMBO_SIZE и PERFECT_MIN_CARDS, что и сервер", () => {
  assert.equal(XP_SOURCES.combo_bonus.amount, 5);
  assert.equal(COMBO_SIZE, 5);
  assert.match(XP_SOURCES.combo_bonus.rule, new RegExp(`каждые ${COMBO_SIZE} верных`));
  assert.equal(XP_SOURCES.perfect_session.amount, 10);
  assert.equal(PERFECT_MIN_CARDS, 5);
  assert.match(XP_SOURCES.perfect_session.rule, new RegExp(`от ${PERFECT_MIN_CARDS} карточек`));
  // и сама проверка реально использует эти значения
  const rows = (grades: number[]) => grades.map((grade, i) => ({ id: `r${i}`, grade, at: i * 20_000 }));
  assert.deepEqual(comboBlockRefs(rows([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2])), ["r0:5", "r0:10"]);
  assert.equal(perfectSession(rows([3, 3, 3, 3])), null, "меньше PERFECT_MIN_CARDS бонуса нет");
  assert.equal(perfectSession(rows([3, 3, 3, 3, 3]))?.ref, "r0");
});

test("дневные лимиты: заданы там, где событие повторяемо; согласованы друг с другом", () => {
  const caps = Object.fromEntries(Object.values(XP_SOURCES).filter((s) => s.dailyCap !== undefined).map((s) => [s.id, s.dailyCap]));
  assert.deepEqual(caps, { review_card: 300, combo_bonus: 60, perfect_session: 30, reading_session: 60, word_saved: 100 });
  // потолки кратны награде: лимит не обрывает «посреди» одного начисления
  for (const s of Object.values(XP_SOURCES)) if (s.dailyCap !== undefined) assert.equal(s.dailyCap % (s.amount ?? 1), 0, s.id);
  // источники без потолка привязаны к уникальному событию, которое не накрутить повтором
  for (const id of ["lesson_complete", "duel_win", "quest_chest", "perfect_week"] as const) assert.equal(XP_SOURCES[id].dailyCap, undefined, id);
  // серия за день не может принести больше, чем верных ответов в рамках лимита карточек: 60 XP = 12 блоков = 60 верных подряд
  assert.ok((XP_SOURCES.combo_bonus.dailyCap! / XP_SOURCES.combo_bonus.amount!) * COMBO_SIZE <= XP_SOURCES.review_card.dailyCap! * XP_SOURCES.review_card.amount!);
});
