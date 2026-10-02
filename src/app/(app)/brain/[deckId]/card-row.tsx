"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { deleteFlashcard, updateFlashcard, type UpdateCardState } from "./actions";

export default function CardRow({
  deckId,
  id,
  front,
  back,
  notes,
}: {
  deckId: string;
  id: string;
  front: string;
  back: string;
  notes: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const submittedRef = useRef(false);

  const action = updateFlashcard.bind(null, deckId, id);
  const [state, formAction, updatePending] = useActionState<UpdateCardState, FormData>(action, {});

  useEffect(() => {
    if (submittedRef.current && !updatePending && !state.error) {
      submittedRef.current = false;
      setIsEditing(false);
    }
  }, [updatePending, state]);

  if (isEditing) {
    return (
      <form
        action={formAction}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="flex flex-col gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2"
      >
        <div className="flex gap-2">
          <input
            name="front"
            defaultValue={front}
            required
            className="w-1/2 rounded-lg border border-[var(--border-strong)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-forest)]"
          />
          <input
            name="back"
            defaultValue={back}
            required
            className="w-1/2 rounded-lg border border-[var(--border-strong)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-forest)]"
          />
        </div>
        <input
          name="notes"
          defaultValue={notes ?? ""}
          placeholder="Заметка (необязательно)"
          className="rounded-lg border border-[var(--border-strong)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-forest)]"
        />
        {state.error && <p className="text-sm text-[var(--color-danger-text)]">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="flex min-h-9 flex-1 items-center justify-center rounded-full border border-[var(--border-strong)] text-sm"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={updatePending}
            className="flex min-h-9 flex-1 items-center justify-center rounded-full bg-forest text-sm font-medium text-white disabled:opacity-50"
          >
            {updatePending ? "…" : "Сохранить"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{front}</p>
        <p className="truncate text-[var(--text-secondary)]">{back}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex min-h-11 min-w-11 items-center justify-center text-[var(--text-secondary)] hover:text-foreground"
          aria-label="Редактировать карточку"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteFlashcard(deckId, id))}
          className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-danger-text)] disabled:opacity-40"
          aria-label="Удалить карточку"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
