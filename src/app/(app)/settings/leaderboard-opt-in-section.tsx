"use client";

import { useState } from "react";
import Link from "next/link";
import SectionHeader from "@/components/product/section-header";
import { track } from "@/lib/posthog-client";
import { updateLeaderboardOptIn } from "./actions";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Соревновательность — недельная лига/лидерборд". Explicit opt-in
// (условие задачи) — чекбокс по умолчанию выключен (initialOptIn приходит
// из profiles.leaderboard_opt_in, default false в миграции), никогда не
// включается сам. При включении на лидерборде виден только производный
// 2-буквенный инициал (никогда email/имя) и агрегат за неделю — см.
// supabase/migrations/0049_weekly_leaderboard.sql.
export default function LeaderboardOptInSection({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !optIn;
    setBusy(true);
    setError(null);
    const result = await updateLeaderboardOptIn(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Не удалось сохранить настройку.");
      return;
    }
    track("leaderboard_opt_in_changed", { opted_in: next });
    setOptIn(next);
  }

  return (
    <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
      <SectionHeader title="Недельная лига" />
      <p className="text-body-sm mt-2 text-[var(--text-secondary)]">
        Сравнивай активность за неделю (слова и повторения) с другими участниками. Виден только
        обезличенный инициал — никогда email или имя.
      </p>
      <label className="mt-3 flex min-h-11 items-center justify-between gap-3 text-body-sm">
        <span>Участвовать в лидерборде</span>
        <input
          type="checkbox"
          checked={optIn}
          disabled={busy}
          onChange={handleToggle}
          aria-label="Участвовать в лидерборде"
          className="focus-ring h-5 w-5"
        />
      </label>
      {error && (
        <p role="alert" className="text-body-sm mt-1 text-[var(--color-danger-text)]">
          {error}
        </p>
      )}
      {optIn && (
        <Link href="/leaderboard" className="focus-ring mt-2 inline-block text-body-sm font-semibold text-[var(--color-forest-text)]">
          Открыть лидерборд →
        </Link>
      )}
    </section>
  );
}
