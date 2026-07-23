"use client";

import { useState } from "react";
import DeckCard from "./deck-card";

interface DeckItem {
  id: string;
  name: string;
  isDefault: boolean;
  cardCount: number;
}

export default function DeckList({ decks }: { decks: DeckItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? decks.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()))
    : decks;

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск колод..."
        className="w-full rounded-lg border border-black/15 bg-card px-4 py-2.5 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
      />

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-black/50 dark:text-white/50">
            Колоды не найдены.
          </p>
        )}
        {filtered.map((d) => (
          <DeckCard key={d.id} id={d.id} name={d.name} isDefault={d.isDefault} cardCount={d.cardCount} />
        ))}
      </div>
    </>
  );
}
