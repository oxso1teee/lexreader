// M3 Slice 10 — single source of truth for word/phrase classification and dedup-key
// normalization. Both were previously duplicated ad hoc (reader.tsx's phraseText.includes(" "),
// vocabulary-list.ts's front.includes(" "), flashcard-dedup.ts's trim().toLowerCase()) — this
// file is the one place every save path now imports from, matching flashcards.item_type/
// normalized_key (migration 0041) so the stored columns and the runtime logic never drift.

export type ItemType = "word" | "phrase";

export function deriveItemType(text: string): ItemType {
  return text.trim().includes(" ") ? "phrase" : "word";
}

export function normalizeVocabularyKey(text: string): string {
  return text.trim().toLowerCase();
}
