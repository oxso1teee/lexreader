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
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-black/60 dark:text-white/60">
        Коллекция (необязательно)
      </label>
      <select
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
        className="rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
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
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Название коллекции (например, «Идиот»)"
          className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
        />
      )}
      <input type="hidden" name="collection_id" value={mode === "existing" ? selectedId : ""} />
      <input type="hidden" name="new_collection_title" value={mode === "new" ? newTitle : ""} />
    </div>
  );
}
