// M3 Slice 10 (brief Phase C §14, task #277) — pure matching/blanking logic for the "Context
// Gap" activation practice mode: given a flashcard's front and one of its saved
// vocabulary_contexts.context_text rows, find the one place the front word/phrase appears
// verbatim in that sentence and blank it out. "Verbatim" is deliberate — no stemming/lemma
// matching, since guessing at inflected forms would mean sometimes blanking the wrong span or
// missing a real occurrence, either of which breaks the "honest, deterministic" rule this whole
// slice runs on. A context only qualifies when the match is unambiguous (exactly one occurrence)
// — a repeated word makes it unclear which occurrence is "the" answer, so that context is simply
// not offered rather than guessed at.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// \p{L}/\p{N} (not \b, which is ASCII-only) so boundaries hold correctly for accented target-
// language text (café, naïve, …), not just plain English.
function buildBoundaryMatcher(front: string): RegExp {
  const escaped = escapeRegExp(front.trim());
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
}

export interface ContextMatch {
  start: number;
  end: number;
}

export function findUnambiguousContextMatch(front: string, contextText: string): ContextMatch | null {
  const trimmed = front.trim();
  if (!trimmed || !contextText) return null;
  const matches = [...contextText.matchAll(buildBoundaryMatcher(trimmed))];
  if (matches.length !== 1) return null;
  const [match] = matches;
  return { start: match.index, end: match.index + match[0].length };
}

export interface ContextGapBlank {
  before: string;
  blanked: string;
  after: string;
}

export function buildContextGapBlank(front: string, contextText: string): ContextGapBlank | null {
  const match = findUnambiguousContextMatch(front, contextText);
  if (!match) return null;
  return {
    before: contextText.slice(0, match.start),
    blanked: contextText.slice(match.start, match.end),
    after: contextText.slice(match.end),
  };
}
