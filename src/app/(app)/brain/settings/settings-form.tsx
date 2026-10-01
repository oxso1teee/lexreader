"use client";

import { useActionState, useState } from "react";
import { CalendarDays, RefreshCw, Settings2, Library, Palette, Save } from "lucide-react";
import type { SrsSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { updateSrsSettings, type SettingsFormState } from "./actions";

function NumberField({
  name,
  label,
  defaultValue,
  step,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={name} className="text-sm">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step={step ?? "1"}
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="w-28 rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-1.5 text-right outline-none focus:border-[var(--color-forest)]"
      />
    </div>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => setChecked((c) => !c)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--color-forest)]" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <input type="checkbox" name={name} checked={checked} readOnly className="hidden" />
    </label>
  );
}

export default function SettingsForm({ settings }: { settings: SrsSettings }) {
  const [direction, setDirection] = useState(settings.study_direction);
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateSrsSettings,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6 pb-6">
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
          Дневные лимиты
        </h2>
        <NumberField
          name="new_cards_per_day"
          label="Новых карточек в день"
          defaultValue={settings.new_cards_per_day}
          min={0}
          max={500}
        />
        <NumberField
          name="max_reviews_per_day"
          label="Повторений в день (макс.)"
          defaultValue={settings.max_reviews_per_day}
          min={0}
          max={1000}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Направление изучения
        </h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Направление по умолчанию</span>
          {/* ghost, не sky: белый на --sky меряется 2.4:1 (light) / 1.9:1 (dark).
              min-h-11 — сохраняем прежнюю 44px-зону нажатия. */}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => setDirection((d) => (d === "front_back" ? "back_front" : "front_back"))}
          >
            {direction === "front_back" ? "Слово → Перевод" : "Перевод → Слово"}
          </Button>
        </div>
        <input type="hidden" name="study_direction" value={direction} />
        <p className="text-xs text-[var(--text-secondary)]">
          {direction === "front_back" ? "Front: слово → Back: перевод" : "Front: перевод → Back: слово"}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Settings2 aria-hidden="true" className="h-4 w-4" />
          Алгоритм повторения (для продвинутых)
        </h2>
        <NumberField
          name="starting_ease"
          label="Стартовый коэффициент лёгкости"
          defaultValue={settings.starting_ease}
          step="0.01"
          min={1.3}
          max={5}
        />
        <NumberField
          name="easy_bonus"
          label="Бонус за «Легко»"
          defaultValue={settings.easy_bonus}
          step="0.01"
          min={1}
          max={3}
        />
        <NumberField
          name="interval_modifier"
          label="Множитель интервала"
          defaultValue={settings.interval_modifier}
          step="0.01"
          min={0.5}
          max={2}
        />
        <NumberField
          name="max_interval_days"
          label="Максимальный интервал (дней)"
          defaultValue={settings.max_interval_days}
          min={1}
          max={3650}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Library aria-hidden="true" className="h-4 w-4" />
          Интервалы «выпуска» карточки
        </h2>
        <NumberField
          name="graduating_interval_days"
          label="Интервал после первого успеха (дней)"
          defaultValue={settings.graduating_interval_days}
          min={1}
          max={30}
        />
        <NumberField
          name="easy_interval_days"
          label="Интервал при ответе «Легко» (дней)"
          defaultValue={settings.easy_interval_days}
          min={1}
          max={60}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Palette aria-hidden="true" className="h-4 w-4" />
          Отображение
        </h2>
        <Toggle name="show_timer" label="Показывать таймер" defaultChecked={settings.show_timer} />
        <Toggle
          name="autoplay_audio"
          label="Автопроигрывание озвучки"
          defaultChecked={settings.autoplay_audio}
        />
      </section>

      {state.error && <p className="text-sm text-[var(--color-danger-text)]">{state.error}</p>}
      {state.saved && <p className="text-sm text-[var(--color-success-text)]">Сохранено.</p>}

      <Button type="submit" variant="leaf" disabled={pending} className="gap-1.5">
        {pending ? (
          "…"
        ) : (
          <>
            <Save aria-hidden="true" className="h-4 w-4" />
            Сохранить настройки
          </>
        )}
      </Button>
    </form>
  );
}
