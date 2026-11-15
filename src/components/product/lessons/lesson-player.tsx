"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useMoments } from "@/components/product/moments/moment-provider";
import type { LessonContent, PathSlug } from "@/lib/learning-paths/types";
import type { AnsweredResult } from "@/lib/lessons/attempt-state";
import type { LessonCompletionDto, LessonSessionDto } from "@/lib/lessons/dto";
import type { ActionResult } from "@/lib/lessons/errors";
import {
  canGoBack,
  clampView,
  describePrimary,
  exercisePosition,
  isFinishView,
  progressRatio,
  resumeView,
  stepCounter,
} from "@/lib/lessons/player-model";
import type { ExerciseResponse, LessonMode } from "@/lib/lessons/types";
import ContentStep, { type LessonOutline } from "./content-steps";
import ExerciseView from "./exercise-view";
import FeedbackPanel from "./feedback-panel";
import LessonComplete from "./lesson-complete";
import LessonHeader from "./lesson-header";
import type { LessonPlayerApi } from "./player-api";
import { PlayerFatal, PlayerLoading, type PlayerError } from "./player-states";
import { serverLessonApi } from "./server-api";
import StepHeading from "./step-heading";

export interface LessonPlayerProps {
  pathSlug: PathSlug;
  mode: LessonMode;
  skill: { key: string; title: string; lesson: LessonContent };
  /** «Урок 3 из 5 · Раздел» — подпись в шапке. */
  subtitle: string;
  /** Страница урока: сюда ведёт выход и «К материалу». */
  lessonUrl: string;
  pathUrl: string;
  loginUrl: string;
  /** Серверные вызовы; по умолчанию — серверные действия. Подменяется в галерее. */
  api?: LessonPlayerApi;
}

type Phase = { kind: "loading" } | { kind: "fatal"; error: PlayerError } | { kind: "ready" };

const NETWORK_ERROR: PlayerError = {
  code: "storage_failed",
  message: "Не удалось связаться с сервером. Проверь соединение и повтори — прогресс не потерян.",
  retryable: true,
};

/** Любой сбой вызова (сеть, перезапуск сервера, «Failed to find Server Action»
 *  после деплоя) превращается в обычную ошибку с понятным текстом. */
async function call<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch {
    return { ok: false, ...NETWORK_ERROR };
  }
}

// Коды, при которых состояние на экране разошлось с сервером: чиним повторным
// запросом сессии (он возвращает актуальную позицию), а не показываем тупик.
const RESYNC_CODES = new Set<PlayerError["code"]>(["stale_plan", "conflict", "out_of_sequence"]);
// Коды, при которых продолжать нельзя: отдельный экран с выходом.
const FATAL_CODES = new Set<PlayerError["code"]>(["unauthorized", "not_found", "locked", "no_exercises"]);

export default function LessonPlayer({ pathSlug, mode, skill, subtitle, lessonUrl, pathUrl, loginUrl, api = serverLessonApi }: LessonPlayerProps) {
  const router = useRouter();
  const { pushMoments } = useMoments();

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [session, setSession] = useState<LessonSessionDto | null>(null);
  const [answered, setAnswered] = useState<Record<string, AnsweredResult>>({});
  const [view, setView] = useState(0);
  const [draft, setDraft] = useState<ExerciseResponse | null>(null);
  const [notice, setNotice] = useState<PlayerError | null>(null);
  const [completion, setCompletion] = useState<LessonCompletionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  // Замок от двойного нажатия: state обновляется асинхронно, и два клика в один
  // тик оба увидели бы busy=false. Ref меняется сразу.
  const busyRef = useRef(false);
  const startedRef = useRef(false);
  const focusedOnceRef = useRef(false);
  const focusPrimaryRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const applySession = useCallback((next: LessonSessionDto) => {
    setSession(next);
    setAnswered(next.answered);
    setView(resumeView(next.stepIndex, next.stepsTotal));
    setDraft(null);
    setCompletion(null);
  }, []);

  const requestSession = useCallback(async (): Promise<boolean> => {
    const result = await call(() => api.start(pathSlug, skill.key, mode));
    if (!result.ok) {
      setPhase({ kind: "fatal", error: result });
      return false;
    }
    applySession(result.data);
    setPhase({ kind: "ready" });
    return true;
  }, [api, applySession, mode, pathSlug, skill.key]);

  useEffect(() => {
    // Защита от двойного вызова эффекта (StrictMode): сервер и так идемпотентен
    // (вторая открытая попытка не создаётся), но лишний запрос ни к чему.
    if (startedRef.current) return;
    startedRef.current = true;
    void requestSession();
  }, [requestSession]);

  const run = useCallback(async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const handleFailure = useCallback(
    async (error: PlayerError) => {
      if (FATAL_CODES.has(error.code)) {
        setPhase({ kind: "fatal", error });
        return;
      }
      if (RESYNC_CODES.has(error.code)) {
        // Подтягиваем актуальное состояние и сообщаем, что произошло.
        if (await requestSession()) setNotice(error);
        return;
      }
      setNotice(error);
    },
    [requestSession],
  );

  // Фокус: при смене шага — на заголовок (скринридер зачитывает новый шаг),
  // после ответа — на кнопку «Далее» (чтобы Enter сразу вёл дальше).
  useEffect(() => {
    if (phase.kind !== "ready") return;
    // Первое появление шага при открытии страницы фокус не забирает: иначе
    // скринридер и клавиатура «перепрыгивают» навигацию страницы.
    if (!focusedOnceRef.current) {
      focusedOnceRef.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [view, phase.kind, completion]);
  useEffect(() => {
    if (focusPrimaryRef.current) {
      focusPrimaryRef.current = false;
      primaryRef.current?.focus();
    }
  }, [answered]);

  const steps = session?.steps ?? [];
  const stepsTotal = session?.stepsTotal ?? 0;
  const step = steps[view];
  const exercise = step?.kind === "exercise" ? step.exercise : undefined;
  const currentResult = exercise ? (answered[exercise.id] ?? null) : null;

  const outline: LessonOutline = {
    hasMistakes: steps.some((s) => s.kind === "content" && s.block === "mistakes"),
    exerciseCount: steps.filter((s) => s.kind === "exercise").length,
  };

  const primary = session
    ? describePrimary({ steps, stepIndex: session.stepIndex, view, answeredIds: new Set(Object.keys(answered)), draft })
    : null;

  const goTo = useCallback(
    (index: number) => {
      if (!session) return;
      setView(clampView(index, session.stepIndex, session.stepsTotal));
      setDraft(null);
      setNotice(null);
    },
    [session],
  );

  const doFinish = useCallback(
    async (attemptId: string) => {
      const result = await call(() => api.finish(attemptId));
      if (!result.ok) {
        await handleFailure(result);
        return;
      }
      setCompletion(result.data);
      setNotice(null);
      // Моменты (цель дня, уровень, раздел пройден) приходят только при первом
      // применении итогов; повторное открытие результата их не повторяет.
      if (result.data.moments.length > 0) pushMoments(result.data.moments);
      router.refresh();
    },
    [api, handleFailure, pushMoments, router],
  );

  async function onPrimary() {
    if (!session || !primary || primary.disabled || busyRef.current) return;

    if (primary.kind === "next") {
      goTo(view + 1);
      return;
    }

    await run(async () => {
      if (primary.kind === "finish") {
        await doFinish(session.attemptId);
        return;
      }

      if (primary.kind === "advance" && step) {
        const result = await call(() => api.advance(session.attemptId, step.id));
        if (!result.ok) return handleFailure(result);
        setSession({ ...session, ...result.data });
        if (view + 1 >= session.stepsTotal) {
          await doFinish(session.attemptId);
        } else {
          setView(view + 1);
          setDraft(null);
          setNotice(null);
        }
        return;
      }

      if (primary.kind === "submit" && exercise && draft) {
        const result = await call(() => api.submit(session.attemptId, exercise.id, draft));
        if (!result.ok) return handleFailure(result);
        focusPrimaryRef.current = true;
        setAnswered((previous) => ({ ...previous, [exercise.id]: result.data.result }));
        setSession({ ...session, ...result.data.progress });
        setNotice(null);
      }
    });
  }

  async function onRetry() {
    await run(async () => {
      setNotice(null);
      await requestSession();
    });
  }

  function requestExit() {
    // Прогресс уже сохранён на сервере после каждого шага — выход ничего не
    // теряет. Подтверждение нужно, только если урок начат и не завершён.
    if (!session || completion || session.stepIndex === 0) {
      router.push(lessonUrl);
      return;
    }
    setExitOpen(true);
  }

  // Esc открывает подтверждение выхода (как в макете «Занятие»). Пока диалог
  // открыт, Esc закрывает его сам.
  useEffect(() => {
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || exitOpen || phase.kind !== "ready" || completion) return;
      if (!session || session.stepIndex === 0) return;
      setExitOpen(true);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [completion, exitOpen, phase.kind, session]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Enter = главное действие (как «Проверить» в макете), но не поверх
    // кнопок и ссылок — у них Enter уже что-то делает.
    if (event.key !== "Enter" || event.shiftKey || exitOpen || completion) return;
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
    event.preventDefault();
    void onPrimary();
  }

  if (phase.kind === "loading") return <PlayerLoading />;
  if (phase.kind === "fatal") {
    return (
      <PlayerFatal
        error={phase.error}
        retrying={busy}
        onRetry={() => {
          setPhase({ kind: "loading" });
          void requestSession();
        }}
        backHref={lessonUrl}
        loginHref={loginUrl}
      />
    );
  }
  if (!session || !primary) return <PlayerLoading />;

  const position = exercisePosition(steps, view);
  const eyebrow = position ? `Задание ${position.number} из ${position.total}` : undefined;

  return (
    <div className="ls" data-state={completion ? "completed" : "playing"} data-mode={mode} onKeyDown={onKeyDown}>
      <LessonHeader
        subtitle={subtitle}
        counter={completion ? "Готово" : stepCounter(view, stepsTotal)}
        ratio={completion ? 1 : progressRatio(session.stepIndex, stepsTotal)}
        progressLabel={`Пройдено шагов: ${completion ? stepsTotal : session.stepIndex} из ${stepsTotal}`}
        onExit={requestExit}
        onBack={!completion && canGoBack(view) ? () => goTo(view - 1) : undefined}
      />

      {completion ? (
        <LessonComplete
          completion={completion}
          skillTitle={skill.title}
          lessonUrl={lessonUrl}
          pathUrl={pathUrl}
          onRetry={() => void onRetry()}
          retrying={busy}
          onRetryXp={() => void run(() => doFinish(session.attemptId))}
          headingRef={headingRef}
        />
      ) : (
        <>
          <div className="ls-main">
            {isFinishView(steps, view) ? (
              <>
                <StepHeading eyebrow="Готово" headingRef={headingRef}>
                  Все шаги пройдены
                </StepHeading>
                <Card className="ls-lead">Осталось подтвердить результат — он сохранится, а следующий урок откроется по правилам пути.</Card>
              </>
            ) : step?.kind === "content" && step.block ? (
              <ContentStep block={step.block} skillKey={skill.key} content={skill.lesson} outline={outline} headingRef={headingRef} />
            ) : exercise ? (
              <>
                <ExerciseView
                  exercise={exercise}
                  draft={draft}
                  onDraftChange={setDraft}
                  result={currentResult}
                  disabled={busy}
                  headingRef={headingRef}
                  eyebrow={eyebrow}
                />
                <FeedbackPanel result={currentResult} />
              </>
            ) : null}

            {notice && (
              <Alert tone="error" live="assertive">
                {notice.message}
              </Alert>
            )}
          </div>

          <div className="ls-actions">
            {primary.hint && (
              <p id="ls-hint" className="ls-hint">
                {primary.hint}
              </p>
            )}
            <Button
              ref={primaryRef}
              variant="leaf"
              loading={busy}
              disabled={primary.disabled}
              aria-describedby={primary.hint ? "ls-hint" : undefined}
              onClick={() => void onPrimary()}
            >
              {primary.label}
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Выйти из урока?"
        description="Прогресс сохранён — ты продолжишь с этого места."
        footer={
          <>
            <Button variant="ghost" onClick={() => setExitOpen(false)}>
              Остаться
            </Button>
            <Button variant="leaf" onClick={() => router.push(lessonUrl)}>
              Выйти
            </Button>
          </>
        }
      />
    </div>
  );
}
