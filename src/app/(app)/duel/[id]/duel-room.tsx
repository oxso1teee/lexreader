"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/posthog-client";
import { describeDuelError, DUEL_ROUND_TIME_LIMIT_MS, type DuelState } from "@/lib/duel";
import { dealNextDuelRoundAction, createDuelAction } from "../actions";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Живые дуэли по словарю 1 на 1". Живое состояние: postgres_changes на
// duels (единственная таблица с открытым SELECT — см. миграцию) как
// основной сигнал "перезапроси get_duel_state()", плюс лёгкий fallback-
// поллинг (на случай, если realtime-событие потерялось — первая realtime-
// фича в проекте, лишняя подстраховка оправдана) и клиентский таймер,
// который форс-резолвит раунд по истечении лимита, если один игрок не
// ответил (сервер — единственный источник правды по времени, см.
// submit_duel_answer/resolve_duel_round_timeout в миграции; клиентский
// таймер только ИНИЦИИРУЕТ вызов, не решает сам).
const FALLBACK_POLL_MS = 3000;
const NEXT_ROUND_DELAY_MS = 2500;

// Date.now() only ever runs inside the interval callback (a real effect),
// never during render — render only ever reads the resulting state value.
function useNowMs(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return nowMs;
}

export default function DuelRoom({
  duelId,
  initialState,
  inviteUrl,
}: {
  duelId: string;
  initialState: DuelState | null;
  inviteUrl: string;
}) {
  const [state, setState] = useState<DuelState | null>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Lazy initializer -- runs exactly once, not on every render (matches
  // useRef's "create once" intent without reading a ref's .current during
  // render, which the stricter react-hooks/refs rule now flags).
  const [supabase] = useState(() => createClient());

  const refetch = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("get_duel_state", { p_duel_id: duelId });
    if (rpcError) {
      setError(describeDuelError(rpcError.message));
      return;
    }
    setState(data as DuelState | null);
  }, [duelId, supabase]);

  // Realtime: единственная таблица с открытым SELECT (duels) как сигнал.
  useEffect(() => {
    const channel = supabase
      .channel(`duel-${duelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels", filter: `id=eq.${duelId}` }, () => {
        void refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [duelId, supabase, refetch]);

  // Fallback poll — первая realtime-фича в проекте, лишняя подстраховка на
  // случай потерянного события оправдана; останавливается, как только
  // дуэль завершена.
  useEffect(() => {
    if (state?.status === "finished") return;
    const id = setInterval(() => void refetch(), FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [state?.status, refetch]);

  const roundKey = state?.round ? `${state.round.index}:${state.round.resolvedAt ?? ""}:${Boolean(state.round.myAnswer)}` : null;
  const countdownActive = Boolean(state?.round && !state.round.resolvedAt && !state.round.myAnswer);
  const nowMs = useNowMs(countdownActive);

  // Раздатчик следующего раунда — только клиент создателя, чтобы не
  // задваивать переводы (deal_duel_round сама по себе идемпотентна, но
  // cachedTranslate() дороже дублировать без нужды).
  useEffect(() => {
    if (!state || state.status !== "active" || !state.isCreator) return;
    const needsFirstRound = !state.round && state.currentRoundIndex === 0;
    const needsNextRound = Boolean(state.round?.resolvedAt) && state.currentRoundIndex < state.roundCount;
    if (!needsFirstRound && !needsNextRound) return;

    const delay = needsNextRound ? NEXT_ROUND_DELAY_MS : 0;
    const timer = setTimeout(() => {
      void dealNextDuelRoundAction(duelId).then((result) => {
        if (!result.ok && result.error) setError(result.error);
        void refetch();
      });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status, state?.isCreator, state?.currentRoundIndex, state?.round?.resolvedAt, duelId]);

  // Форс-резолв по таймауту — любой из двух участников может его
  // инициировать; сам сервер (resolve_duel_round_timeout) отказывается
  // резолвить раньше настоящего лимита.
  useEffect(() => {
    if (!state?.round || state.round.resolvedAt) return;
    const deadline = new Date(state.round.startedAt).getTime() + DUEL_ROUND_TIME_LIMIT_MS + 750;
    const delay = Math.max(0, deadline - Date.now());
    const timer = setTimeout(() => {
      void supabase
        .rpc("resolve_duel_round_timeout", { p_duel_id: duelId, p_round_index: state.round!.index })
        .then(() => void refetch());
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  async function handleJoin() {
    setBusy(true);
    setError(null);
    const { error: joinError } = await supabase.rpc("join_duel", { p_duel_id: duelId });
    setBusy(false);
    if (joinError) {
      setError(describeDuelError(joinError.message));
      return;
    }
    track("duel_joined");
    await refetch();
  }

  async function handleAnswer(option: string) {
    if (!state?.round || busy) return;
    setBusy(true);
    setError(null);
    const { error: answerError } = await supabase.rpc("submit_duel_answer", {
      p_duel_id: duelId,
      p_round_index: state.round.index,
      p_answer: option,
    });
    setBusy(false);
    if (answerError) {
      setError(describeDuelError(answerError.message));
      return;
    }
    track("duel_answer_submitted");
    await refetch();
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!state) {
    return (
      <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-body-sm text-[var(--text-secondary)]">Дуэль не найдена — возможно, ссылка неверна.</p>
        <Link href="/duel" className="focus-ring mt-3 inline-block text-body-sm font-semibold text-[var(--color-forest-text)]">
          ← Создать свою дуэль
        </Link>
      </section>
    );
  }

  // Кружки с инициалами — тот же паттерн, что leaderboard/page.tsx и
  // profile-card.tsx (bg-forest/15 + text-[--color-forest-text]), а не
  // голый текст "Имя: счёт" — визуальное согласование с остальным
  // приложением, механику счёта не меняет.
  const scoreRow = (
    <div className="flex items-center justify-center gap-5">
      <ScoreSide initials={state.creatorInitials} score={state.creatorScore} isMe={state.isCreator} />
      <span className="pt-2 text-caption font-bold text-[var(--text-secondary)]">VS</span>
      <ScoreSide initials={state.opponentInitials ?? "…"} score={state.opponentScore} isMe={!state.isCreator} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-2xl bg-[var(--color-danger-text)]/10 p-3 text-body-sm text-[var(--color-danger-text)]">
          {error}
        </p>
      )}

      {!state.isParticipant && state.status === "waiting" && (
        <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
          <p className="text-h3 mb-1">{state.creatorInitials} приглашает тебя на дуэль по словарю</p>
          <p className="text-body-sm mb-4 text-[var(--text-secondary)]">{state.roundCount} раундов, одинаковые слова для обоих.</p>
          <button
            type="button"
            disabled={busy}
            onClick={handleJoin}
            className="focus-ring mx-auto flex min-h-11 items-center rounded-full bg-forest px-6 text-body-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "…" : "Присоединиться"}
          </button>
        </section>
      )}

      {!state.isParticipant && state.status !== "waiting" && (
        <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
          <p className="text-body-sm text-[var(--text-secondary)]">Эта дуэль уже началась без тебя.</p>
        </section>
      )}

      {state.isParticipant && state.status === "waiting" && (
        <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
          <p className="text-h3 mb-1">Ждём соперника…</p>
          <p className="text-body-sm mb-4 text-[var(--text-secondary)]">Пришли ссылку другу, чтобы начать.</p>
          <div className="mx-auto flex max-w-sm items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--background)] px-2 py-1.5 text-caption whitespace-nowrap">{inviteUrl}</code>
            <button
              type="button"
              onClick={handleCopyLink}
              className="focus-ring flex min-h-11 shrink-0 items-center rounded-full bg-forest px-3 text-body-sm font-medium text-white"
            >
              {copied ? "Скопировано ✓" : "Копировать"}
            </button>
          </div>
        </section>
      )}

      {state.status === "active" && (
        <>
          {scoreRow}
          {!state.round ? (
            <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
              <p className="text-body-sm text-[var(--text-secondary)]">Готовим первый раунд…</p>
            </section>
          ) : (
            <RoundView round={state.round} onAnswer={handleAnswer} busy={busy} nowMs={nowMs} />
          )}
        </>
      )}

      {state.status === "finished" && (
        <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
          <p className="text-h3 mb-1">
            {state.isDraw ? "Ничья!" : state.winnerIsMe ? "Ты выиграл! 🎉" : "Соперник выиграл"}
          </p>
          {scoreRow}
          <div className="mt-4 flex flex-col items-center gap-2">
            <form action={createDuelAction}>
              <button
                type="submit"
                className="focus-ring flex min-h-11 items-center rounded-full bg-forest px-5 text-body-sm font-medium text-white"
              >
                Играть ещё раз
              </button>
            </form>
            <Link href="/progress" className="focus-ring text-body-sm text-[var(--color-forest-text)]">
              К прогрессу
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function ScoreSide({ initials, score, isMe }: { initials: string; score: number; isMe: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full text-body-sm font-semibold ${
          isMe ? "bg-forest text-white" : "bg-forest/15 text-[var(--color-forest-text)]"
        }`}
      >
        {initials}
      </div>
      <span className="text-caption text-[var(--text-secondary)]">{isMe ? "Ты" : "Соперник"}</span>
      <span className="font-mono text-body-sm font-bold tabular-nums">{score}</span>
    </div>
  );
}

function RoundView({
  round,
  onAnswer,
  busy,
  nowMs,
}: {
  round: NonNullable<DuelState["round"]>;
  onAnswer: (option: string) => void;
  busy: boolean;
  nowMs: number;
}) {
  const startedAtMs = new Date(round.startedAt).getTime();
  const remainingMs = Math.max(0, startedAtMs + DUEL_ROUND_TIME_LIMIT_MS - nowMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  if (round.resolvedAt) {
    return (
      <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-caption text-[var(--text-secondary)]">Раунд {round.index}</p>
        <p className="text-h3 my-2">{round.word}</p>
        <p className="text-body-sm mb-3">
          Правильный ответ: <strong>{round.correctAnswer}</strong>
        </p>
        <div className="flex justify-center gap-6 text-body-sm">
          <span className={round.myAnswer?.isCorrect ? "text-[var(--color-success-text)]" : "text-[var(--color-danger-text)]"}>
            Ты: {round.myAnswer?.answer || "—"} {round.myAnswer?.isCorrect ? "✓" : "✗"}
          </span>
          <span className={round.opponentAnswer?.isCorrect ? "text-[var(--color-success-text)]" : "text-[var(--color-danger-text)]"}>
            Соперник: {round.opponentAnswer?.answer || "—"} {round.opponentAnswer?.isCorrect ? "✓" : "✗"}
          </span>
        </div>
        <p className="text-caption mt-3 text-[var(--text-secondary)]">Следующий раунд скоро начнётся…</p>
      </section>
    );
  }

  if (round.myAnswer) {
    return (
      <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-caption text-[var(--text-secondary)]">Раунд {round.index}</p>
        <p className="text-h3 my-2">{round.word}</p>
        <p className="text-body-sm text-[var(--text-secondary)]">
          {round.opponentAnswered ? "Соперник тоже ответил — подводим итог…" : "Ответ принят — ждём соперника…"}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
      <div className="mb-2 flex items-center justify-between text-caption text-[var(--text-secondary)]">
        <span>Раунд {round.index}</span>
        <span aria-live="polite">{remainingSeconds}с</span>
      </div>
      <p className="text-h3 mb-4">{round.word}</p>
      <div className="flex flex-col gap-2">
        {round.options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={busy}
            onClick={() => onAnswer(opt)}
            className="focus-ring rounded-2xl border border-black/10 px-4 py-3 text-left transition-colors hover:border-black/30 disabled:opacity-50 dark:border-white/15 dark:hover:border-white/40"
          >
            {opt}
          </button>
        ))}
      </div>
      {round.opponentAnswered && (
        <p className="text-caption mt-3 text-[var(--text-secondary)]">Соперник уже ответил — твоя очередь.</p>
      )}
    </section>
  );
}
