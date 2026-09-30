"use client";

import { createText } from "../actions";
import { useAddMaterialAction } from "./use-add-material-action";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

export default function NewTextForm({ collections }: { collections: CollectionOption[] }) {
  const [state, formAction, pending] = useAddMaterialAction("text", createText, {});

  if (state.paywall) {
    return <PaywallNotice />;
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-text-title" className="text-sm font-semibold">
          Название
        </label>
        <input
          id="new-text-title"
          type="text"
          name="title"
          required
          placeholder="Например: Утро в кофейне"
          className="focus-ring w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-base outline-none"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="new-text-body" className="text-sm font-semibold">
          Текст
        </label>
        <textarea
          id="new-text-body"
          name="body"
          required
          rows={16}
          placeholder="Вставь текст на изучаемом языке…"
          className="focus-ring w-full flex-1 resize-none rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-base leading-7 outline-none"
        />
        <p className="text-xs text-[var(--text-secondary)]">Минимум пара предложений, максимум 200 000 символов.</p>
      </div>
      <CollectionPicker collections={collections} />
      {state.error && (
        <p className="text-sm text-[var(--color-danger-text)]" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="focus-ring min-h-11 rounded-full bg-[var(--color-forest)] px-5 py-3 font-bold text-white transition-colors hover:bg-[var(--color-forest-deep)] disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Добавить в библиотеку"}
      </button>
    </form>
  );
}
