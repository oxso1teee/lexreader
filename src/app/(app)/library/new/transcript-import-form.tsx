"use client";

import { createText } from "../actions";
import { useAddMaterialAction } from "./use-add-material-action";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

// M3 Slice 3: механически это тот же путь, что и обычный текст (createText,
// без нового server action) — отдельная вкладка существует только как более
// понятная точка входа для конкретного сценария («у меня уже есть транскрипт
// откуда-то ещё»), см. docs/ui/m3-slice3-library-reader-plan.md §5.
export default function TranscriptImportForm({ collections }: { collections: CollectionOption[] }) {
  const [state, formAction, pending] = useAddMaterialAction("transcript", createText, {});

  if (state.paywall) {
    return <PaywallNotice />;
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="transcript-title" className="text-sm font-semibold">
          Название
        </label>
        <input
          id="transcript-title"
          type="text"
          name="title"
          required
          placeholder="Например: подкаст об истории Лондона"
          className="focus-ring w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-base outline-none"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="transcript-body" className="text-sm font-semibold">
          Транскрипт
        </label>
        <textarea
          id="transcript-body"
          name="body"
          required
          rows={16}
          placeholder="Скопируй транскрипт из любого источника и вставь сюда…"
          className="focus-ring w-full flex-1 resize-none rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-base leading-7 outline-none"
        />
        <p className="text-xs text-[var(--text-secondary)]">
          Сохраняется как обычный текст, без синхронизации с аудио/видео.
        </p>
      </div>
      <CollectionPicker collections={collections} />
      {state.error && (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
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
