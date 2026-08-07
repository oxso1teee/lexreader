"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { track } from "@/lib/posthog-client";
import Dialog from "@/components/product/language-twin/dialog";
import type { LanguageTwinSettings } from "@/lib/language-twin/types";
import { resetLanguageTwinAction, updateSettingsAction, recomputeAction } from "../actions";

const SOURCES: { key: keyof LanguageTwinSettings; label: string; desc: string }[] = [
  { key: "include_review_history", label: "История повторений (Мозг)", desc: "Оценки карточек, точность, повторяющиеся ошибки" },
  { key: "include_saved_vocabulary", label: "Сохранённые слова (Читалка)", desc: "Слова и фразы, уровень знания слова" },
  { key: "include_reading_behavior", label: "Поведение в чтении", desc: "Сессии чтения, темп, активность" },
  { key: "include_writing_exercises", label: "Проверка предложений", desc: "Предложения, которые ты сам присылаешь на проверку" },
  { key: "allow_diagnostic", label: "Мини-диагностика", desc: "Результаты короткой диагностики" },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <span className="absolute inset-0 rounded-full bg-black/15 transition-colors peer-checked:bg-caramel peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus-ring)] peer-focus-visible:outline-offset-2 dark:bg-white/20" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

export default function SettingsForm({ settings }: { settings: LanguageTwinSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function toggleEnabled(v: boolean) {
    track(v ? "language_twin_enabled" : "language_twin_disabled", {});
    startTransition(() => updateSettingsAction({ enabled: v }));
  }
  function toggleSource(key: keyof LanguageTwinSettings, v: boolean) {
    startTransition(() => updateSettingsAction({ [key]: v } as Partial<LanguageTwinSettings>));
  }
  function handleRecompute() {
    startTransition(async () => {
      const res = await recomputeAction();
      setToast(res.ok ? "Профиль пересчитан" : (res.error ?? "Ошибка"));
    });
  }
  function handleReset() {
    setConfirmingReset(false);
    track("language_twin_reset", {});
    startTransition(async () => {
      await resetLanguageTwinAction();
      router.push("/language-twin");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Language Twin включён</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Отключение остановит новые выводы, но не удалит уже накопленные данные
            </p>
          </div>
          <Switch checked={settings.enabled} onChange={toggleEnabled} label="Включить Language Twin" />
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Источники данных</h2>
        <div className="flex flex-col gap-3">
          {SOURCES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">{s.label}</p>
                <p className="text-xs text-[var(--text-secondary)]">{s.desc}</p>
              </div>
              <Switch
                checked={Boolean(settings[s.key])}
                onChange={(v) => toggleSource(s.key, v)}
                label={s.label}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Обработка данных</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Все вычисления происходят на нашем сервере, на основе твоих собственных данных. Мы не отправляем
          текст, слова или предложения во внешние ИИ-сервисы и не используем платные API для этой функции.
        </p>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Управление данными</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleRecompute}
            className="focus-ring self-start rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            ↻ Пересчитать профиль сейчас
          </button>
          <Link
            href="/language-twin/diagnostic"
            className="focus-ring self-start rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            🧭 Обновить оценку (пройти диагностику ещё раз)
          </Link>
          <a
            href="/api/export/data"
            download
            className="focus-ring self-start rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            ⬇ Экспортировать все данные (включая Language Twin)
          </a>
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="focus-ring self-start rounded-full border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger-text)]"
          >
            🗑 Сбросить Language Twin
          </button>
        </div>
        {toast && (
          <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">
            {toast}
          </p>
        )}
      </div>

      {confirmingReset && (
        <Dialog titleId="reset-title" title="Сбросить Language Twin?" onClose={() => setConfirmingReset(false)}>
          <p className="text-sm">
            Все паттерны, записи и рекомендации будут удалены безвозвратно. Твои слова, карточки и
            история повторений в Мозге и Читалке не пострадают — это касается только Language Twin.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleReset}
              className="focus-ring rounded-full bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Да, сбросить
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
            >
              Отмена
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
