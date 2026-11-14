"use client";

import { useState } from "react";
import LessonPlayer from "@/components/product/lessons/lesson-player";
import type { LessonPlayerApi } from "@/components/product/lessons/player-api";
import { Button } from "@/components/ui/button";
import { getAllSkills, getPath } from "@/lib/learning-paths/curriculum/index";
import { emptySkillProgress } from "@/lib/learning-paths/progress-engine";
import type { PathSlug, SkillProgressRow } from "@/lib/learning-paths/types";
import { advanceStep, finishSession, startSession, submitAnswer } from "@/lib/lessons/service";
import { createHarness, type Harness } from "@/lib/lessons/testing/memory";
import type { LessonMode } from "@/lib/lessons/types";
import type { PlayerScreen } from "./lesson-screens";

// Интерактивный стенд плеера уроков. Это отдельный модуль не случайно: он тянет
// настоящий service.ts вместе с планом и банком грамматики, то есть ВСЕ правильные
// ответы. Подключается из lesson-gallery.tsx только вне production-сборки (под
// `next dev`), чтобы банк ответов не попал в публичные клиентские чанки.
// Интерактивные экраны (Player-*) — настоящий LessonPlayer, а вместо серверных
// действий подставлен настоящий service.ts с хранилищем в памяти: тот же код, что
// исполняется на сервере, и те же ограничения БД. Панель «Стенд» под плеером —
// инструмент галереи (сбои записи/сети/XP, повторное открытие, счётчики).

interface PlayerConfig {
  pathSlug: PathSlug;
  skillKey: string;
  mode: LessonMode;
  /** Уроки до этого пройдены (урок открыт); false — прогресса нет (урок закрыт). */
  unlocked: boolean;
}

const PLAYER_CONFIGS = {
  "Player-lesson": { pathSlug: "a2-b1", skillKey: "grammar.present_simple", mode: "lesson", unlocked: true },
  "Player-check": { pathSlug: "a2-b1", skillKey: "grammar.present_simple", mode: "check", unlocked: true },
  "Player-topic": { pathSlug: "everyday", skillKey: "topic.small_talk", mode: "lesson", unlocked: true },
  "Player-reading": { pathSlug: "a2-b1", skillKey: "vocabulary.active_recall", mode: "lesson", unlocked: true },
  "Player-locked": { pathSlug: "a2-b1", skillKey: "grammar.past_simple", mode: "lesson", unlocked: false },
} as const satisfies Record<PlayerScreen, PlayerConfig>;

function rowsDoneBefore(pathSlug: PathSlug, skillKey: string): SkillProgressRow[] {
  const path = getPath(pathSlug);
  if (!path) return [];
  const skills = getAllSkills(path);
  const index = skills.findIndex((s) => s.key === skillKey);
  return skills.slice(0, index).map((skill, i) => ({
    id: `fixture-${i}`,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...emptySkillProgress("gallery-user", path, skill.key),
    status: "introduced",
    content_completed_at: "2026-01-01T00:00:00.000Z",
  }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- интерактивный стенд ----------

interface Stand {
  harness: Harness;
  api: LessonPlayerApi;
  /** Счётчики вызовов и последняя попытка — только для чтения в рендере. */
  flags: { networkDown: boolean; lastAttempt: string | null; calls: { start: number; advance: number; submit: number; finish: number } };
  /** Следующий вызов плеера оборвётся, как при потере сети. */
  dropNetwork(): void;
  /** Следующее начисление XP не пройдёт (addXp вернёт null). */
  failNextXp(): void;
}

function createStand(config: PlayerConfig, onChange: () => void): Stand {
  const path = getPath(config.pathSlug)!;
  const address = { pathSlug: config.pathSlug, pathVersion: path.version, skillKey: config.skillKey };
  const harness = createHarness(address, {
    userId: "gallery-user",
    rows: config.unlocked ? rowsDoneBefore(config.pathSlug, config.skillKey) : [],
  });
  const flags: Stand["flags"] = { networkDown: false, lastAttempt: null, calls: { start: 0, advance: 0, submit: 0, finish: 0 } };

  async function guard<T>(name: keyof Stand["flags"]["calls"], task: () => Promise<T>): Promise<T> {
    flags.calls[name]++;
    await sleep(150); // чтобы состояние «идёт отправка» было видно и проверяемо
    if (flags.networkDown) {
      flags.networkDown = false;
      onChange();
      throw new Error("network down");
    }
    const result = await task();
    onChange();
    return result;
  }

  const api: LessonPlayerApi = {
    start: (slug, key, mode) =>
      guard("start", async () => {
        const result = await startSession(harness.deps, { ...address, pathSlug: slug as PathSlug, skillKey: key }, mode);
        if (result.ok) flags.lastAttempt = result.data.attemptId;
        return result;
      }),
    advance: (id, stepId) => guard("advance", () => advanceStep(harness.deps, id, stepId)),
    submit: (id, exerciseId, response) => guard("submit", () => submitAnswer(harness.deps, id, exerciseId, response)),
    finish: (id) => guard("finish", () => finishSession(harness.deps, id)),
  };
  return {
    harness,
    api,
    flags,
    dropNetwork: () => {
      flags.networkDown = true;
      onChange();
    },
    failNextXp: () => {
      harness.rewards.failNextGrant = true;
      onChange();
    },
  };
}

export default function PlayerStand({ screen }: { screen: PlayerScreen }) {
  const config: PlayerConfig = PLAYER_CONFIGS[screen];
  const path = getPath(config.pathSlug)!;
  const skill = getAllSkills(path).find((s) => s.key === config.skillKey)!;

  const [, setTick] = useState(0);
  const [stand] = useState(() => createStand(config, () => setTick((n) => n + 1)));
  const [epoch, setEpoch] = useState(0);
  const [replay, setReplay] = useState("");
  const { harness, api, flags, dropNetwork, failNextXp } = stand;
  const bump = () => setTick((n) => n + 1);

  const row = harness.store.rows.at(-1);
  const status = [
    `attempts=${harness.store.rows.length}`,
    `status=${row?.status ?? "-"}`,
    `stepIndex=${row?.stepIndex ?? "-"}`,
    `answers=${row?.answers.length ?? 0}`,
    `correct=${row?.correctCount ?? 0}`,
    `incorrect=${row?.incorrectCount ?? 0}`,
    `xpGrants=${harness.rewards.xpGrants.join("+") || "-"}`,
    `xpFailed=${harness.rewards.failedGrants}`,
    `claimed=${harness.store.rows.filter((r) => r.xpClaimedAt !== null).length}`,
    `calls=${flags.calls.start}/${flags.calls.advance}/${flags.calls.submit}/${flags.calls.finish}`,
  ].join(" ");

  return (
    <div className="lp page-content">
      <LessonPlayer
        key={epoch}
        api={api}
        pathSlug={config.pathSlug}
        mode={config.mode}
        skill={{ key: skill.key, title: skill.title, lesson: skill.lesson }}
        subtitle={config.mode === "check" ? `Проверка знаний · ${skill.title}` : `Урок 1 из 5 · ${path.stages[0].title}`}
        lessonUrl="/dev/screens?s=Lesson-current"
        pathUrl="/dev/screens?s=Curriculum"
        loginUrl="/login"
      />

      <section aria-label="Стенд галереи" className="mx-auto flex w-full max-w-[40rem] flex-col gap-2 rounded-xl border border-dashed border-[var(--border-strong)] p-3 text-xs">
        <p className="m-0 font-bold">Стенд (только галерея)</p>
        <p className="m-0 break-all text-[var(--text-secondary)]" data-testid="harness-status">
          {status}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEpoch((n) => n + 1)}>
            Закрыть и открыть заново
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              harness.store.failNext("saveProgress");
              bump();
            }}
          >
            Сбой записи
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={dropNetwork}
          >
            Обрыв сети
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={failNextXp}
          >
            Сбой начисления XP
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!flags.lastAttempt) return;
              const result = await finishSession(harness.deps, flags.lastAttempt);
              setReplay(
                result.ok
                  ? `ok finalizedNow=${result.data.finalizedNow} xp=${result.data.xpAwarded} correct=${result.data.correctCount} moments=${result.data.moments.length}`
                  : `error ${result.code}`,
              );
              bump();
            }}
          >
            Завершить ещё раз
          </Button>
        </div>
        <p className="m-0 text-[var(--text-secondary)]" data-testid="harness-replay">
          {replay}
        </p>
      </section>
    </div>
  );
}
