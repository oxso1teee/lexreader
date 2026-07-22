"use client";

import { useActionState, useState } from "react";
import type { SrsSettings } from "@/lib/types";
import { updateSrsSettings, type SettingsFormState } from "./actions";

function NumberField({
  name,
  label,
  defaultValue,
  step,
}: {
  name: string;
  label: string;
  defaultValue: number;
  step?: string;
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
        defaultValue={defaultValue}
        className="w-28 rounded-lg border border-black/20 px-3 py-1.5 text-right outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
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
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-black/20 dark:bg-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
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
        <h2 className="font-semibold">📅 Daily Limits</h2>
        <NumberField name="new_cards_per_day" label="New cards per day" defaultValue={settings.new_cards_per_day} />
        <NumberField name="max_reviews_per_day" label="Max reviews per day" defaultValue={settings.max_reviews_per_day} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">🔄 Study Direction</h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Default direction</span>
          <button
            type="button"
            onClick={() => setDirection((d) => (d === "front_back" ? "back_front" : "front_back"))}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white"
          >
            {direction === "front_back" ? "Слово → Перевод" : "Перевод → Слово"}
          </button>
        </div>
        <input type="hidden" name="study_direction" value={direction} />
        <p className="text-xs text-black/40 dark:text-white/40">
          {direction === "front_back" ? "Front: слово → Back: перевод" : "Front: перевод → Back: слово"}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">⚙️ SRS Algorithm (Advanced)</h2>
        <NumberField name="starting_ease" label="Starting ease (%)" defaultValue={settings.starting_ease} step="0.01" />
        <NumberField name="easy_bonus" label="Easy bonus (%)" defaultValue={settings.easy_bonus} step="0.01" />
        <NumberField name="interval_modifier" label="Interval modifier (%)" defaultValue={settings.interval_modifier} step="0.01" />
        <NumberField name="max_interval_days" label="Maximum interval (days)" defaultValue={settings.max_interval_days} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">📚 Learning Steps</h2>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="learning_steps_minutes" className="text-sm">
            Learning steps (minutes)
          </label>
          <input
            id="learning_steps_minutes"
            name="learning_steps_minutes"
            type="text"
            defaultValue={settings.learning_steps_minutes}
            className="w-28 rounded-lg border border-black/20 px-3 py-1.5 text-right outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
          />
        </div>
        <p className="-mt-2 text-xs text-black/40 dark:text-white/40">
          Separate with commas (e.g., &quot;1, 10&quot;)
        </p>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="relearning_steps_minutes" className="text-sm">
            Relearning steps (minutes)
          </label>
          <input
            id="relearning_steps_minutes"
            name="relearning_steps_minutes"
            type="text"
            defaultValue={settings.relearning_steps_minutes}
            className="w-28 rounded-lg border border-black/20 px-3 py-1.5 text-right outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
          />
        </div>
        <NumberField
          name="graduating_interval_days"
          label="Graduating interval (days)"
          defaultValue={settings.graduating_interval_days}
        />
        <NumberField name="easy_interval_days" label="Easy interval (days)" defaultValue={settings.easy_interval_days} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">🎨 Display</h2>
        <Toggle name="show_timer" label="Show timer" defaultChecked={settings.show_timer} />
        <Toggle name="autoplay_audio" label="Auto-play audio" defaultChecked={settings.autoplay_audio} />
      </section>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">Сохранено.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"
      >
        {pending ? "…" : "💾 Save Settings"}
      </button>
    </form>
  );
}
