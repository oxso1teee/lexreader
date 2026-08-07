import type { PatternCategory } from "./types";

// Versioned, fixed question bank — deterministic scoring only, no free-text
// grading. Bump DIAGNOSTIC_VERSION whenever the question set changes so a
// user's diagnostic evidence can be traced to the exact bank that produced
// it (plan doc §6/§14 — never claim a precise CEFR level from this).
export const DIAGNOSTIC_VERSION = 1;

export interface DiagnosticQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  tag: PatternCategory;
}

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "q1_tense",
    prompt: "She ___ in London since 2019.",
    options: ["live", "has lived", "is living", "lived"],
    correctIndex: 1,
    tag: "tense",
  },
  {
    id: "q2_article",
    prompt: "I need ___ advice.",
    options: ["a", "an", "the", "— (без артикля)"],
    correctIndex: 3,
    tag: "article",
  },
  {
    id: "q3_passive",
    prompt: "This book was written ___ him.",
    options: ["by", "from", "of", "with"],
    correctIndex: 0,
    tag: "passive",
  },
  {
    id: "q4_gerund",
    prompt: "I enjoy ___ books.",
    options: ["read", "to read", "reading", "reads"],
    correctIndex: 2,
    tag: "gerund_infinitive",
  },
  {
    id: "q5_preposition",
    prompt: "She is interested ___ art.",
    options: ["of", "in", "at", "for"],
    correctIndex: 1,
    tag: "preposition",
  },
  {
    id: "q6_word_order",
    prompt: "Выбери верный порядок слов:",
    options: [
      "Yesterday I saw him.",
      "I yesterday saw him.",
      "Saw I him yesterday.",
      "I saw yesterday him.",
    ],
    correctIndex: 0,
    tag: "word_order",
  },
];

export interface DiagnosticTagScore {
  correct: number;
  total: number;
}

export interface DiagnosticScore {
  correct: number;
  total: number;
  byTag: Record<string, DiagnosticTagScore>;
}

// Pure — no I/O. `answers[i]` is the selected option index for
// DIAGNOSTIC_QUESTIONS[i]; a missing/skipped answer is `null`.
export function scoreDiagnostic(answers: (number | null)[]): DiagnosticScore {
  const byTag: Record<string, DiagnosticTagScore> = {};
  let correct = 0;
  let total = 0;

  DIAGNOSTIC_QUESTIONS.forEach((q, i) => {
    const answer = answers[i];
    if (answer === null || answer === undefined) return;
    total += 1;
    const tagScore = byTag[q.tag] ?? { correct: 0, total: 0 };
    tagScore.total += 1;
    if (answer === q.correctIndex) {
      correct += 1;
      tagScore.correct += 1;
    }
    byTag[q.tag] = tagScore;
  });

  return { correct, total, byTag };
}

// Deliberately coarse — a 6-question diagnostic cannot honestly claim a
// precise CEFR letter+number (plan doc §14). Returns a range string only
// when there's a clear enough signal to say anything at all.
export function diagnosticLevelRange(score: DiagnosticScore): string | null {
  if (score.total < 4) return null;
  const ratio = score.correct / score.total;
  if (ratio >= 0.85) return "B2+";
  if (ratio >= 0.6) return "B1–B2";
  if (ratio >= 0.35) return "A2–B1";
  return "A1–A2";
}
