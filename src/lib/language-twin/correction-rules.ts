import type { ConfidenceLevel, PatternCategory } from "./types";

// M3 Slice 5 — deterministic Correction Input engine. Curated regex/lookup
// rules only, no NLP dependency (none exists in package.json today, none is
// added), no external API. Every rule below targets a specific, well
// documented Russian→English transfer error rather than attempting general
// grammar understanding — see docs/ui/m3-slice5-language-twin-plan.md §6/§17
// for why this is deliberately limited, not a placeholder for something
// bigger.

export interface CorrectionMatch {
  patternKey: string;
  category: PatternCategory;
  confidence: ConfidenceLevel;
  explanation: string;
  suggestion: string;
}

export interface CorrectionResult {
  supported: boolean;
  matches: CorrectionMatch[];
}

const MAX_INPUT_LENGTH = 400;

interface PrepositionRule {
  patternKey: string;
  re: RegExp;
  explanation: string;
  suggestion: string;
}

// Small, reviewable, expand-over-time list — each pair is a well-known
// literal-translation error from Russian, not a guess.
const PREPOSITION_RULES: PrepositionRule[] = [
  {
    patternKey: "prep_depend_of",
    re: /\bdepends?\s+of\b/i,
    explanation: '«depend» обычно требует предлога «on», не «of» — частый перенос из русского «зависеть от».',
    suggestion: "depend on",
  },
  {
    patternKey: "prep_married_with",
    re: /\bmarried\s+with\b/i,
    explanation: '«married» обычно требует предлога «to», не «with».',
    suggestion: "married to",
  },
  {
    patternKey: "prep_interested_for",
    re: /\binterested\s+(?:for|of)\b/i,
    explanation: '«interested» обычно требует предлога «in».',
    suggestion: "interested in",
  },
  {
    patternKey: "prep_afraid_from",
    re: /\bafraid\s+from\b/i,
    explanation: '«afraid» обычно требует предлога «of», не «from».',
    suggestion: "afraid of",
  },
  {
    patternKey: "prep_explain_for",
    re: /\bexplain\s+(?:for|to)\s+me\b/i,
    explanation: '«explain» обычно строится как «explain X to me», а не «explain for me».',
    suggestion: "explain it to me",
  },
];

// Deliberately low confidence: this is a shape heuristic, not a real
// determiner/article analyzer, and it will have real false positives on any
// sentence where the noun is already covered by context. It only checks for
// a small set of clearly-countable-singular nouns after a small set of verbs
// with no article/determiner between them.
const ARTICLE_HEURISTIC = {
  patternKey: "article_missing_singular",
  re: /\b(?:read|bought|saw|took|need|have|want|found)\s+(book|car|apple|idea|dog|cat|plan|letter|question|job)\b/i,
  explanation:
    "Возможно, перед исчисляемым существительным в единственном числе не хватает артикля «a». Это эвристика с частыми ложными срабатываниями — не точный грамматический разбор.",
  suggestion: 'добавить "a" перед существительным',
};

// Classic literal-translation possession pattern ("машина моего друга" →
// "the car of my friend" instead of "my friend's car").
const POSSESSION_HEURISTIC = {
  patternKey: "possession_of_pattern",
  re: /\bthe\s+\w+\s+of\s+my\s+(?:friend|brother|sister|mother|father|colleague|neighbor|neighbour)\b/i,
  explanation:
    'В английском для людей чаще используют притяжательный падеж («my friend\'s car»), а не конструкцию «the X of Y», которая звучит как дословный перевод с русского.',
  suggestion: "my friend's ...",
};

// A short, genuinely common confusion list — not a spellchecker, just a
// deterministic lookup for a handful of frequently-swapped word pairs.
const SPELLING_CONFUSIONS: { patternKey: string; re: RegExp; explanation: string; suggestion: string }[] = [
  {
    patternKey: "spelling_loose_lose",
    re: /\bi\s+will\s+loose\b/i,
    explanation: '«loose» (свободный, просторный) и «lose» (терять) — разные слова. Здесь, вероятно, имелось в виду «lose».',
    suggestion: "I will lose",
  },
  {
    patternKey: "spelling_their_there",
    re: /\btheir\s+is\b/i,
    explanation: '«their» (их) и «there» (там/there is) — разные слова.',
    suggestion: "there is",
  },
];

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

// Pure — no I/O, fully unit-testable. Returns supported=false only for
// input that can't be checked at all (empty, too long, no Latin letters) —
// never for "no known pattern matched", which is a legitimate clean result.
export function checkSentence(rawText: string): CorrectionResult {
  const text = normalize(rawText);

  if (text.length === 0) return { supported: false, matches: [] };
  if (text.length > MAX_INPUT_LENGTH) return { supported: false, matches: [] };
  if (!/[a-zA-Z]/.test(text)) return { supported: false, matches: [] };

  const matches: CorrectionMatch[] = [];

  for (const rule of PREPOSITION_RULES) {
    if (rule.re.test(text)) {
      matches.push({
        patternKey: rule.patternKey,
        category: "preposition",
        confidence: "medium",
        explanation: rule.explanation,
        suggestion: rule.suggestion,
      });
    }
  }

  if (ARTICLE_HEURISTIC.re.test(text)) {
    matches.push({
      patternKey: ARTICLE_HEURISTIC.patternKey,
      category: "article",
      confidence: "low",
      explanation: ARTICLE_HEURISTIC.explanation,
      suggestion: ARTICLE_HEURISTIC.suggestion,
    });
  }

  if (POSSESSION_HEURISTIC.re.test(text)) {
    matches.push({
      patternKey: POSSESSION_HEURISTIC.patternKey,
      category: "possession",
      confidence: "low",
      explanation: POSSESSION_HEURISTIC.explanation,
      suggestion: POSSESSION_HEURISTIC.suggestion,
    });
  }

  for (const rule of SPELLING_CONFUSIONS) {
    if (rule.re.test(text)) {
      matches.push({
        patternKey: rule.patternKey,
        category: "spelling",
        confidence: "medium",
        explanation: rule.explanation,
        suggestion: rule.suggestion,
      });
    }
  }

  return { supported: true, matches };
}
