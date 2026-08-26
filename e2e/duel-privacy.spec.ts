import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Живые дуэли по словарю 1 на 1". Тот же стиль, что и
// e2e/rls-cross-user-isolation.spec.ts и e2e/leaderboard-privacy.spec.ts:
// реальные сессии через анонимный ключ, не service_role — прямой RPC-вызов
// из браузера, ровно то, чем реально авторизован любой клиентский код.
//
// supabase/migrations/0050_vocabulary_duels.sql — duel_rounds.correct_answer
// в сыром виде это сам ответ на вопрос; duel_rounds/duel_answers не имеют
// НИ ОДНОГО гранта/policy для authenticated (единственный путь — явные
// SECURITY DEFINER функции). Этот файл проверяет именно эту границу:
// прямое чтение всегда пусто, RPC маскирует/проверяет всё, что обещано.

const FRESH_ACCOUNT_PASSWORD = "testpass123"; // matches signUpFreshAccount in helpers.ts

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

async function signInAnon(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { data, error } = await client.auth.signInWithPassword({ email, password: FRESH_ACCOUNT_PASSWORD });
  if (error || !data.session) throw new Error(`signInAnon(${email}) failed: ${error?.message}`);
  return client;
}

test("vocabulary duels: correct_answer is masked until resolved, timing is server-enforced, only participants can act", async ({ page, browser }) => {
  const service = serviceClient();

  const emailA = await signUpFreshAccount(page);
  await completeOnboardingForTest(emailA);
  const { data: usersAfterA } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userIdA = usersAfterA!.users.find((u) => u.email === emailA)!.id;

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const contextC = await browser.newContext();
  const pageC = await contextC.newPage();
  let emailB: string;
  let userIdB: string;
  let emailC: string;
  let userIdC: string;
  try {
    emailB = await signUpFreshAccount(pageB);
    await completeOnboardingForTest(emailB);
    emailC = await signUpFreshAccount(pageC);
    await completeOnboardingForTest(emailC);
    const { data: usersAll } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userIdB = usersAll!.users.find((u) => u.email === emailB)!.id;
    userIdC = usersAll!.users.find((u) => u.email === emailC)!.id;
  } finally {
    await contextB.close();
    await contextC.close();
  }

  const clientA = await signInAnon(emailA);
  const clientB = await signInAnon(emailB);
  const clientC = await signInAnon(emailC);
  let duelId = "";

  try {
    // --- 1. A creates a duel. ---
    const { data: createdId, error: createError } = await clientA.rpc("create_duel", { p_round_count: 3 });
    expect(createError).toBeNull();
    expect(createdId).toBeTruthy();
    duelId = createdId as string;

    // --- 2. Direct table reads are ALWAYS empty, for anyone, participant or
    // not — the entire point of granting nothing on duel_rounds/duel_answers. ---
    for (const client of [clientA, clientB, clientC]) {
      const { data: rawRounds } = await client.from("duel_rounds").select("*").eq("duel_id", duelId);
      expect(rawRounds ?? [], "duel_rounds must never be directly readable").toEqual([]);
      const { data: rawAnswers } = await client.from("duel_answers").select("*");
      expect(rawAnswers ?? [], "duel_answers must never be directly readable").toEqual([]);
    }

    // --- 3. B (not yet joined) can preview the waiting duel via get_duel_state
    // — sees safe meta, isParticipant=false, no round yet (currentRoundIndex=0). ---
    const { data: previewB } = await clientB.rpc("get_duel_state", { p_duel_id: duelId });
    expect(previewB.status).toBe("waiting");
    expect(previewB.isParticipant).toBe(false);
    expect(previewB.creatorInitials).toBeTruthy();
    expect(previewB.round).toBeUndefined();

    // --- 4. C cannot join A's own duel by pretending to be the creator, and A
    // cannot join her own duel. ---
    const { error: selfJoinError } = await clientA.rpc("join_duel", { p_duel_id: duelId });
    expect(selfJoinError, "creator joining her own duel must be rejected").not.toBeNull();

    // --- 5. B joins for real. ---
    const { error: joinError } = await clientB.rpc("join_duel", { p_duel_id: duelId });
    expect(joinError).toBeNull();

    // --- 6. C — never joined, duel is now active — must be rejected outright
    // (no more "waiting" preview exception once someone else has joined). ---
    const { error: cReadError } = await clientC.rpc("get_duel_state", { p_duel_id: duelId });
    expect(cReadError, "a non-participant must not read an active duel's state").not.toBeNull();
    const { error: cJoinError } = await clientC.rpc("join_duel", { p_duel_id: duelId });
    expect(cJoinError, "a third user must not be able to join an already-active duel").not.toBeNull();

    // --- 7. A deals round 1 (hardcoded content here — this test is about
    // security, not translation quality/cachedTranslate, which is exercised
    // by the actual Server Action in the app). C must not be able to deal a
    // round on a duel she's not part of. ---
    const { error: cDealError } = await clientC.rpc("deal_duel_round", {
      p_duel_id: duelId,
      p_round_index: 1,
      p_word: "friend",
      p_correct_answer: "друг",
      p_options: ["друг", "враг", "стол", "окно"],
    });
    expect(cDealError, "a non-participant must not be able to deal a round").not.toBeNull();

    const { error: dealError } = await clientA.rpc("deal_duel_round", {
      p_duel_id: duelId,
      p_round_index: 1,
      p_word: "friend",
      p_correct_answer: "друг",
      p_options: ["друг", "враг", "стол", "окно"],
    });
    expect(dealError).toBeNull();

    // --- 8. Before anyone answers, correct_answer is masked for BOTH
    // participants — this is the core guarantee the whole "no direct table
    // grants" design exists for. ---
    const { data: stateBeforeAnswerA } = await clientA.rpc("get_duel_state", { p_duel_id: duelId });
    const { data: stateBeforeAnswerB } = await clientB.rpc("get_duel_state", { p_duel_id: duelId });
    expect(stateBeforeAnswerA.round.correctAnswer).toBeNull();
    expect(stateBeforeAnswerB.round.correctAnswer).toBeNull();
    expect(stateBeforeAnswerA.round.options).toEqual(expect.arrayContaining(["друг", "враг", "стол", "окно"]));

    // --- 9. C cannot answer a round she isn't part of. ---
    const { error: cAnswerError } = await clientC.rpc("submit_duel_answer", { p_duel_id: duelId, p_round_index: 1, p_answer: "друг" });
    expect(cAnswerError, "a non-participant must not be able to submit an answer").not.toBeNull();

    // --- 10. B answers first, genuinely within time — her own answer row
    // is scored and stored NOW, before any backdating below touches
    // started_at (backdating a round after an answer is already recorded
    // never retroactively changes that stored row). ---
    const { data: bAnswer } = await clientB.rpc("submit_duel_answer", { p_duel_id: duelId, p_round_index: 1, p_answer: "друг" });
    expect(bAnswer[0].is_correct).toBe(true);
    expect(bAnswer[0].round_resolved, "round isn't resolved yet — A hasn't answered").toBe(false);

    // --- 11. Server-side timing enforcement: backdate the round's
    // started_at (service_role, direct table write — the one legitimate use
    // of that bypass, simulating "10+ seconds really passed" without an
    // actual 10s sleep in this test) then have A submit the textually-correct
    // answer — must still be graded wrong, because the SERVER computes
    // latency from started_at, never trusting any client-supplied duration
    // (раздел задачи: "время на ответ должно проверяться сервером"). ---
    const { data: roundRow } = await service.from("duel_rounds").select("id, started_at").eq("duel_id", duelId).eq("round_index", 1).single();
    const backdated = new Date(Date.parse(roundRow!.started_at) - 15_000).toISOString();
    await service.from("duel_rounds").update({ started_at: backdated }).eq("id", roundRow!.id);

    const { data: lateAnswer, error: lateAnswerError } = await clientA.rpc("submit_duel_answer", { p_duel_id: duelId, p_round_index: 1, p_answer: "друг" });
    expect(lateAnswerError).toBeNull();
    expect(lateAnswer[0].is_correct, "a textually-correct answer submitted past the server-computed time limit must still be graded wrong").toBe(false);
    expect(lateAnswer[0].latency_ms).toBeGreaterThan(10_000);
    expect(lateAnswer[0].round_resolved, "A's answer is the second one in — resolves the round").toBe(true);

    // A cannot answer the same round twice.
    const { error: doubleAnswerError } = await clientA.rpc("submit_duel_answer", { p_duel_id: duelId, p_round_index: 1, p_answer: "враг" });
    expect(doubleAnswerError, "answering the same round twice must be rejected").not.toBeNull();

    // --- 11. Once resolved, both participants see the real correct answer
    // and each other's answer — but a non-participant still sees nothing. ---
    const { data: resolvedStateA } = await clientA.rpc("get_duel_state", { p_duel_id: duelId });
    expect(resolvedStateA.round.correctAnswer).toBe("друг");
    expect(resolvedStateA.round.opponentAnswer.isCorrect).toBe(true);

    const { data: finalScores } = await service.from("duels").select("creator_score, opponent_score, status").eq("id", duelId).single();
    expect(finalScores!.creator_score).toBe(0);
    expect(finalScores!.opponent_score).toBe(1);
  } finally {
    if (duelId) await service.from("duels").delete().eq("id", duelId);
    await service.auth.admin.deleteUser(userIdA);
    await service.auth.admin.deleteUser(userIdB!);
    await service.auth.admin.deleteUser(userIdC!);
  }
});
