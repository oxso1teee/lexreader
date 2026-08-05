// P0-АУДИТ (раздел 5): .ilike() трактует % и _ как wildcard-символы — без
// экранирования слово вроде "50%" могло бы случайно совпасть с несвязанной
// записью. Own zero-import module (not defined in vocabulary.ts, which pulls
// in @/lib/... aliases Node's native test runner can't resolve) so callers
// that need to stay unit-testable via `node --test` (flashcard-dedup.ts)
// don't drag that chain in just for this one-line regex.
export function escapeIlike(s: string): string {
  return s.replace(/[%_]/g, (c) => `\\${c}`);
}
