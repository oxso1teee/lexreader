import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseServerClient } from "../supabase/server.ts";
import { FakeDb } from "./testing/fake-supabase.ts";
import { createSupabaseAttemptStore, toAttemptRecord } from "./supabase-store.ts";
import type { AttemptStore } from "./ports.ts";
import type { SkillAddress } from "./types.ts";

const address: SkillAddress = { pathSlug: "a2-b1", pathVersion: 1, skillKey: "grammar.present_simple" };
const input = { ...address, mode: "lesson" as const, stepsTotal: 6, signature: "sig" };
const asClient = (db: FakeDb) => db.client() as unknown as SupabaseServerClient;

function setup(userId = "user-a", db = new FakeDb()): { db: FakeDb; store: AttemptStore } {
  const client = asClient(db);
  return { db, store: createSupabaseAttemptStore({ read: client, write: client, userId, now: () => "2026-02-02T00:00:00.000Z" }) };
}

async function completedAttempt(store: AttemptStore, mode: "lesson" | "check" = "lesson") {
  const attempt = await store.create({ ...input, mode });
  const done = await store.markCompleted(attempt.id, { passed: true, scoreRatio: 1, correctCount: 5, incorrectCount: 0 });
  assert.ok(done);
  return done;
}

test("create: пишет user_id из серверной сессии и возвращает запись", async () => {
  const { db, store } = setup("user-a");
  const attempt = await store.create(input);
  assert.equal(attempt.userId, "user-a");
  assert.equal(attempt.status, "in_progress");
  assert.equal(attempt.stepsTotal, 6);
  assert.equal(attempt.signature, "sig");
  assert.equal(db.rows("lesson_attempts").length, 1);
});

test("create: двойной вызов (гонка) возвращает уже созданную открытую попытку, а не ошибку", async () => {
  const { db, store } = setup();
  const [a, b] = await Promise.all([store.create(input), store.create(input)]);
  assert.equal(a.id, b.id);
  assert.equal(db.rows("lesson_attempts").length, 1);
});

test("create: ошибка БД (не 23505) пробрасывается", async () => {
  const { db, store } = setup();
  db.injectError("lesson_attempts", "insert", { message: "connection reset" });
  await assert.rejects(() => store.create(input), /connection reset/);
});

test("findById/findOpen: только свои строки — чужая попытка недоступна даже по точному id", async () => {
  const db = new FakeDb();
  const alice = setup("alice", db).store;
  const mallory = setup("mallory", db).store;
  const attempt = await alice.create(input);

  assert.equal((await alice.findById(attempt.id))?.id, attempt.id);
  assert.equal(await mallory.findById(attempt.id), null);
  assert.equal(await mallory.findOpen(address, "lesson"), null);
  assert.equal((await alice.findOpen(address, "lesson"))?.id, attempt.id);
  assert.equal(await alice.findOpen(address, "check"), null, "другой режим — другая попытка");
});

test("запись чужой попытки невозможна: saveProgress/markCompleted/claimXp/abandon/finalize для чужого владельца ничего не меняют", async () => {
  const db = new FakeDb();
  const alice = setup("alice", db).store;
  const mallory = setup("mallory", db).store;
  const attempt = await alice.create(input);

  assert.equal(await mallory.saveProgress(attempt.id, 0, { stepIndex: 1, answers: [], correctCount: 0, incorrectCount: 0 }), null);
  assert.equal(await mallory.markCompleted(attempt.id, { passed: true, scoreRatio: 1, correctCount: 5, incorrectCount: 0 }), null);
  await mallory.abandon(attempt.id);
  await mallory.markFinalized(attempt.id);
  const row = db.rows("lesson_attempts")[0];
  assert.equal(row.status, "in_progress");
  assert.equal(row.step_index, 0);
  assert.equal(row.finalized_at, null);
});

test("saveProgress: запись с ожидаемой позицией; устаревшая позиция (проигранная гонка) → null", async () => {
  const { db, store } = setup();
  const attempt = await store.create(input);
  const answers = [{ exerciseId: "q", response: { type: "choice" as const, index: 0 }, correct: true, at: "t" }];

  const saved = await store.saveProgress(attempt.id, 0, { stepIndex: 1, answers, correctCount: 1, incorrectCount: 0 });
  assert.equal(saved?.stepIndex, 1);
  assert.equal(saved?.correctCount, 1);
  assert.deepEqual(saved?.answers, answers);

  const stale = await store.saveProgress(attempt.id, 0, { stepIndex: 1, answers: [], correctCount: 0, incorrectCount: 0 });
  assert.equal(stale, null, "позиция уже 1");
  assert.equal(db.rows("lesson_attempts")[0].correct_count, 1, "проигравший не затёр результат");
});

test("saveProgress: нельзя писать в завершённую попытку", async () => {
  const { store } = setup();
  const done = await completedAttempt(store);
  assert.equal(await store.saveProgress(done.id, 0, { stepIndex: 1, answers: [], correctCount: 0, incorrectCount: 0 }), null);
});

test("markCompleted: срабатывает один раз", async () => {
  const { store } = setup();
  const attempt = await store.create(input);
  const first = await store.markCompleted(attempt.id, { passed: true, scoreRatio: 0.8, correctCount: 4, incorrectCount: 1 });
  const second = await store.markCompleted(attempt.id, { passed: false, scoreRatio: 0, correctCount: 0, incorrectCount: 5 });
  assert.equal(first?.status, "completed");
  assert.equal(first?.passed, true);
  assert.equal(first?.scoreRatio, 0.8);
  assert.equal(second, null, "повторное завершение не перезаписывает результат");
});

test("claimXp: выигрывает ровно один вызов; повтор и чужая попытка — false", async () => {
  const { db, store } = setup();
  const done = await completedAttempt(store);
  const results = await Promise.all([store.claimXp(done.id, 20), store.claimXp(done.id, 20), store.claimXp(done.id, 20)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(db.rows("lesson_attempts").filter((r) => r.xp_claimed_at !== null).length, 1);
  assert.equal(await store.claimXp(done.id, 20), false);
});

test("claimXp: попытка не в статусе completed XP не получает", async () => {
  const { store } = setup();
  const open = await store.create(input);
  assert.equal(await store.claimXp(open.id, 20), false);
});

test("claimXp: право на XP — одно на навык: вторая попытка того же навыка получает false (23505), а не ошибку", async () => {
  const { db, store } = setup();
  const lesson = await completedAttempt(store, "lesson");
  const check = await completedAttempt(store, "check");
  assert.equal(await store.claimXp(lesson.id, 20), true);
  assert.equal(await store.claimXp(check.id, 20), false);
  assert.equal(db.rows("lesson_attempts").filter((r) => r.xp_claimed_at !== null).length, 1);
  assert.equal(await store.xpClaimSource(address), "lesson", "награду занял урок — по нему и объясняем её источник");
  assert.equal(await store.xpClaimSource({ ...address, skillKey: "grammar.past_simple" }), null);
});

test("claimXp: другая ошибка БД пробрасывается", async () => {
  const { db, store } = setup();
  const done = await completedAttempt(store);
  db.injectError("lesson_attempts", "update", { message: "timeout", code: "57014" });
  await assert.rejects(() => store.claimXp(done.id, 20), /timeout/);
});

test("setXpAwarded уточняет сумму только у получившей право попытки", async () => {
  const { db, store } = setup();
  const done = await completedAttempt(store);
  await store.setXpAwarded(done.id, 40);
  assert.equal(db.rows("lesson_attempts")[0].xp_awarded, 0, "пока право не занято — не пишем");
  await store.claimXp(done.id, 20);
  await store.setXpAwarded(done.id, 40);
  assert.equal(db.rows("lesson_attempts")[0].xp_awarded, 40);
});

test("abandon закрывает только открытую попытку; markFinalized ставит отметку один раз", async () => {
  const { db, store } = setup();
  const open = await store.create(input);
  await store.abandon(open.id);
  assert.equal(db.rows("lesson_attempts")[0].status, "abandoned");
  assert.equal(await store.findOpen(address, "lesson"), null);
  const next = await store.create(input);
  assert.notEqual(next.id, open.id, "после abandon можно начать новую");

  const fin = setup("user-f");
  const attempt = await completedAttempt(fin.store);
  await fin.store.markFinalized(attempt.id);
  const first = fin.db.rows("lesson_attempts")[0].finalized_at;
  assert.ok(first);
  await fin.store.markFinalized(attempt.id);
  assert.equal(fin.db.rows("lesson_attempts")[0].finalized_at, first);
});

test("ошибки чтения пробрасываются (сервис превращает их в storage_failed)", async () => {
  const { db, store } = setup();
  db.injectError("lesson_attempts", "select", { message: "read failed" });
  await assert.rejects(() => store.findById("00000000-0000-0000-0000-0000000000aa"), /read failed/);
});

test("findById: id не в формате UUID (приходит от клиента) — «не найдено» без запроса к БД, а не сбой хранилища", async () => {
  const { db, store } = setup();
  const before = db.log.length;
  for (const id of ["x", "", "1; drop table lesson_attempts", "../../etc", "00000000-0000-0000-0000-00000000000g"]) {
    assert.equal(await store.findById(id), null, id);
  }
  assert.equal(db.log.length, before, "ни одного запроса");
});

test("releaseXpClaim: освобождает право только у завершённой попытки с занятым правом; потом его можно занять снова", async () => {
  const { db, store } = setup();
  const done = await completedAttempt(store);
  await store.releaseXpClaim(done.id);
  assert.equal(db.rows("lesson_attempts")[0].xp_claimed_at, null, "нечего освобождать — ничего не меняется");

  assert.equal(await store.claimXp(done.id, 20), true);
  await store.releaseXpClaim(done.id);
  assert.equal(db.rows("lesson_attempts")[0].xp_claimed_at, null);
  assert.equal(db.rows("lesson_attempts")[0].xp_awarded, 0);
  assert.equal(await store.xpClaimSource(address), null);
  assert.equal(await store.claimXp(done.id, 20), true, "право можно занять снова");
});

test("releaseXpClaim: чужая попытка не затрагивается; ошибка БД пробрасывается", async () => {
  const db = new FakeDb();
  const alice = setup("alice", db).store;
  const mallory = setup("mallory", db).store;
  const done = await completedAttempt(alice);
  await alice.claimXp(done.id, 20);
  await mallory.releaseXpClaim(done.id);
  assert.notEqual(db.rows("lesson_attempts")[0].xp_claimed_at, null);

  db.injectError("lesson_attempts", "update", { message: "boom" });
  await assert.rejects(() => alice.releaseXpClaim(done.id), /boom/);
});

test("toAttemptRecord: numeric из PostgREST приводится к числу, мусор в answers не ломает чтение", () => {
  const record = toAttemptRecord({
    id: "1",
    user_id: "u",
    path_slug: "a2-b1",
    path_version: 1,
    skill_key: "k",
    mode: "lesson",
    status: "completed",
    step_index: 3,
    steps_total: 3,
    plan_signature: "s",
    answers: { not: "array" },
    correct_count: 1,
    incorrect_count: 0,
    passed: true,
    score_ratio: "0.8",
    xp_awarded: 0,
    xp_claimed_at: null,
    started_at: "t",
    last_activity_at: "t",
    completed_at: "t",
    finalized_at: null,
  });
  assert.equal(record.scoreRatio, 0.8);
  assert.deepEqual(record.answers, []);
});
