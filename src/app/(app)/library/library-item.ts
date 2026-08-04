// Shared shape for the unified Library grid (M3 Slice 3) — one normalized
// type for both standalone texts and collections, computed server-side in
// page.tsx from real Supabase rows only (docs/ui/m3-slice3-library-reader-plan.md).
export type LibraryItemKind = "text" | "collection";
export type LibraryTypeFilter = "all" | "text" | "video" | "collection" | "completed";

export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  title: string;
  href: string;
  language: string;
  levelTag: string | null;
  youtubeVideoId: string | null;
  isSystem: boolean;
  canDelete: boolean;
  percentRead: number;
  lastReadAt: string | null;
  savedWordsCount: number;
  savedPhrasesCount: number;
  partCount: number | null;
}

// "Книги"/"Видео"/"Тексты" map onto real fields with zero schema change —
// see plan doc §5. "Завершённые" reuses the same percent_read>=100
// criterion already computed for the "Первая книга" achievement.
export function matchesFilter(item: LibraryItem, filter: LibraryTypeFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "collection":
      return item.kind === "collection";
    case "video":
      return item.kind === "text" && item.youtubeVideoId !== null;
    case "text":
      return item.kind === "text" && item.youtubeVideoId === null;
    case "completed":
      return item.percentRead >= 100;
  }
}

export function typeLabel(item: LibraryItem): string {
  if (item.kind === "collection") return "Книга";
  if (item.youtubeVideoId) return "Видео";
  return "Текст";
}

export function matchesSearch(item: LibraryItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.title.toLowerCase().includes(q) || typeLabel(item).toLowerCase().includes(q);
}

export function materialsCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "материал"
      : [2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)
        ? "материала"
        : "материалов";
  return `${count} ${word}`;
}
