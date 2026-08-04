"use client";

import { createTextFromUrl } from "../actions";
import { useAddMaterialAction } from "./use-add-material-action";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

export default function UrlImportForm({ collections }: { collections: CollectionOption[] }) {
  const [state, formAction, pending] = useAddMaterialAction("url", createTextFromUrl, {});

  if (state.paywall) {
    return <PaywallNotice />;
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="url-import-url" className="text-sm font-semibold">
          Ссылка на статью
        </label>
        <input
          id="url-import-url"
          type="url"
          name="url"
          required
          placeholder="https://example.com/статья"
          className="focus-ring w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-base outline-none"
        />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Загрузим страницу и вытащим только текст статьи, без рекламы и меню.
      </p>
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
        {pending ? "Загружаем…" : "Импортировать статью"}
      </button>
    </form>
  );
}
