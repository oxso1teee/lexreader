"use client";

import { useState } from "react";

export interface CollectionOption {
  id: string;
  title: string;
}

// Идея из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, п.1): вместо
// автосклейки всех страниц сайта пользователь сам решает, что несколько
// импортированных текстов — части одной книги/серии. Скрытые поля читаются
// resolveCollectionAssignment() на сервере (общий для всех 4 форм импорта).
export default function CollectionPicker({ collections }: { collections: CollectionOption[] }) {
  const [mode, setMode] = useState<"none" | "existing" | "new">("none");
  const [selectedId, setSelectedId] = useState(collections[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState("");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="collection-picker-select" className="text-sm font-semibold">
        Коллекция (необязательно)
      </label>
      <select
        id="collection-picker-select"
        value={mode === "new" ? "__new__" : mode === "none" ? "__none__" : selectedId}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__new__") setMode("new");
          else if (v === "__none__") setMode("none");
          else {
            setMode("existing");
            setSelectedId(v);
          }
        }}
        className="focus-ring rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm"
      >
        <option value="__none__">Без коллекции</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
        <option value="__new__">+ Новая коллекция…</option>
      </select>
      {mode === "new" && (
        <>
          <label htmlFor="collection-picker-new-title" className="sr-only">
            Название новой коллекции
          </label>
          <input
            id="collection-picker-new-title"
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название коллекции (например, «Идиот»)"
            className="focus-ring rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm outline-none"
          />
        </>
      )}
      <input type="hidden" name="collection_id" value={mode === "existing" ? selectedId : ""} />
      <input type="hidden" name="new_collection_title" value={mode === "new" ? newTitle : ""} />
    </div>
  );
}
