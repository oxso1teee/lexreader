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

// Second, complementary possession slip: the apostrophe-s is dropped
// entirely ("my friend car" instead of "my friend's car") rather than
// replaced with the "of" construction above. Restricted to a small, closed
// person+noun vocabulary so it never fires on ordinary noun compounds like
// "my friend group".
const POSSESSIVE_PERSONS = ["friend", "brother", "sister", "mother", "father", "colleague", "neighbor", "neighbour", "wife", "husband", "boss", "teacher"];
const POSSESSIVE_NOUNS = ["car", "book", "house", "phone", "bag", "dog", "cat", "room", "name", "job", "laptop", "keys"];
const POSSESSIVE_MISSING_APOSTROPHE_RE = new RegExp(
  `\\bmy\\s+(${POSSESSIVE_PERSONS.join("|")})\\s+(${POSSESSIVE_NOUNS.join("|")})\\b`,
  "i",
);

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
  {
    patternKey: "spelling_recieve",
    re: /\brecieve[sd]?\b/i,
    explanation: '«i» и «e» перепутаны местами — по правилу "i before e except after c" здесь пишется «receive».',
    suggestion: "receive",
  },
  {
    patternKey: "spelling_definately",
    re: /\bdefinately\b/i,
    explanation: 'Частая опечатка — правильно «definitely» (через «-itely», не «-ately»).',
    suggestion: "definitely",
  },
  {
    patternKey: "spelling_seperate",
    re: /\bseperate\b/i,
    explanation: 'Частая опечатка — правильно «separate» (через «-para-», не «-pera-»).',
    suggestion: "separate",
  },
];

// Curated verb→base lookup, reused in both directions: it defines which
// -ing forms the continuous-tense and gerund/infinitive rules below
// recognize, and lets us reconstruct an exact, correctly-spelled base form
// instead of guessing with a generic de-suffixing algorithm (which breaks on
// doubled consonants like "running" or silent-e verbs like "making").
const ING_TO_BASE: Record<string, string> = {
  cleaning: "clean", working: "work", playing: "play", studying: "study", doing: "do",
  going: "go", coming: "come", eating: "eat", drinking: "drink", reading: "read",
  writing: "write", walking: "walk", running: "run", talking: "talk", watching: "watch",
  listening: "listen", sleeping: "sleep", cooking: "cook", driving: "drive", swimming: "swim",
  dancing: "dance", singing: "sing", thinking: "think", waiting: "wait", sitting: "sit",
  standing: "stand", living: "live", learning: "learn", teaching: "teach", helping: "help",
  calling: "call", looking: "look", feeling: "feel", trying: "try", using: "use",
  making: "make", taking: "take", giving: "give", getting: "get", having: "have",
  buying: "buy", selling: "sell", building: "build", growing: "grow", crying: "cry",
  laughing: "laugh", smiling: "smile", shopping: "shop", traveling: "travel", travelling: "travel",
  painting: "paint", drawing: "draw", typing: "type", coding: "code", programming: "program",
  testing: "test", checking: "check", fixing: "fix", washing: "wash", planning: "plan",
  preparing: "prepare", meeting: "meet", visiting: "visit", staying: "stay", moving: "move",
  carrying: "carry",
};
const BASE_TO_ING: Record<string, string> = Object.fromEntries(
  Object.entries(ING_TO_BASE).map(([ing, base]) => [base, ing]),
);
const CONTINUOUS_VERBS_RE_FRAGMENT = Object.keys(ING_TO_BASE).join("|");

const BE_FOR_SUBJECT: Record<string, string> = {
  i: "am", he: "is", she: "is", it: "is", we: "are", you: "are", they: "are",
};

// Missing "be" in Present Continuous — a subject pronoun directly followed
// by a bare -ing verb with no auxiliary between them ("I cleaning", "he
// working"). Restricted to a curated verb whitelist (not any \w+ing) so it
// never matches non-verb -ing nouns like "morning" or "something", and
// restricted to subject-form pronouns (not "him"/"her"/"them") so it never
// fires inside constructions like "I remember him saying that". A real
// auxiliary between the pronoun and the verb ("I am cleaning") already
// breaks the adjacency this regex requires, so correct sentences never
// match; contractions ("I'm cleaning") have no space for the same reason.
const MISSING_CONTINUOUS_AUX_RE = new RegExp(
  `\\b(I|he|she|it|we|you|they)\\s+(${CONTINUOUS_VERBS_RE_FRAGMENT})\\b`,
  "i",
);

function checkMissingContinuousAux(text: string): CorrectionMatch | null {
  const match = MISSING_CONTINUOUS_AUX_RE.exec(text);
  if (!match) return null;
  const subject = match[1];
  const verb = match[2].toLowerCase();
  const be = BE_FOR_SUBJECT[subject.toLowerCase()];
  return {
    patternKey: "aux_missing_present_continuous",
    category: "tense",
    confidence: "high",
    explanation: `В Present Continuous перед формой на -ing нужен вспомогательный глагол «to be» — после «${subject}» не хватает «${be}».`,
    suggestion: `${subject} ${be} ${verb}`,
  };
}

// Subject–"be" agreement mismatch ("he are", "I is", "they am"). Each
// alternative only lists the *wrong* be-forms for that pronoun group, so a
// correct sentence ("he is", "they are") never matches any branch.
const BE_AGREEMENT_RULES: { re: RegExp; correctBe: string }[] = [
  { re: /\b(he|she|it)\s+(am|are)\b/i, correctBe: "is" },
  { re: /\b(I)\s+(is|are)\b/, correctBe: "am" },
  { re: /\b(we|you|they)\s+(am|is)\b/i, correctBe: "are" },
];

function checkBeAgreement(text: string): CorrectionMatch | null {
  for (const rule of BE_AGREEMENT_RULES) {
    const match = rule.re.exec(text);
    if (!match) continue;
    const subject = match[1];
    const wrongBe = match[2];
    return {
      patternKey: "be_agreement_mismatch",
      category: "tense",
      confidence: "high",
      explanation: `С подлежащим «${subject}» используется «${rule.correctBe}», а не «${wrongBe}».`,
      suggestion: `${subject} ${rule.correctBe}`,
    };
  }
  return null;
}

// Fronted "always"/"never" directly before a subject pronoun ("Always I go
// there") — a classic word-order transfer error; in English the frequency
// adverb normally sits after the subject. Deliberately excludes adverbs
// like "sometimes"/"usually"/"often", which are grammatical sentence-
// openers in English ("Sometimes I wonder...") and would make this a false
// positive if included.
const FRONTED_ADVERB_RE = /^(Always|Never)\s+(I|he|she|it|we|you|they)\b/i;

function checkFrontedAdverb(text: string): CorrectionMatch | null {
  const match = FRONTED_ADVERB_RE.exec(text);
  if (!match) return null;
  const adverb = match[1];
  const subject = match[2];
  return {
    patternKey: "word_order_fronted_adverb",
    category: "word_order",
    confidence: "medium",
    explanation: `Наречия частотности вроде «${adverb.toLowerCase()}» обычно стоят после подлежащего, а не в самом начале предложения.`,
    suggestion: `${subject} ${adverb.toLowerCase()} ...`,
  };
}

// Malformed passive: a form of "be" followed by the Past Simple form of a
// common irregular verb instead of its Past Participle ("was wrote" instead
// of "was written"). A closed irregular-verb lookup, not general morphology
// — for these verbs Past Simple and Past Participle are reliably different,
// so this never produces a wrong suggestion.
const PAST_SIMPLE_TO_PARTICIPLE: Record<string, string> = {
  wrote: "written", broke: "broken", spoke: "spoken", took: "taken", gave: "given",
  ate: "eaten", saw: "seen", did: "done", went: "gone", chose: "chosen",
  drove: "driven", forgot: "forgotten", stole: "stolen", threw: "thrown",
};
const PASSIVE_WRONG_PARTICIPLE_RE = new RegExp(
  `\\b(was|were|is|are|been|being)\\s+(${Object.keys(PAST_SIMPLE_TO_PARTICIPLE).join("|")})\\b`,
  "i",
);

function checkPassiveWrongParticiple(text: string): CorrectionMatch | null {
  const match = PASSIVE_WRONG_PARTICIPLE_RE.exec(text);
  if (!match) return null;
  const be = match[1];
  const wrongForm = match[2].toLowerCase();
  const correct = PAST_SIMPLE_TO_PARTICIPLE[wrongForm];
  return {
    patternKey: "passive_wrong_participle",
    category: "passive",
    confidence: "high",
    explanation: `После «${be}» в пассивном залоге нужна форма Past Participle, а «${wrongForm}» — это форма Past Simple. Правильно: «${correct}».`,
    suggestion: `${be} ${correct}`,
  };
}

// Gerund/infinitive verb-choice: verbs like "want"/"decide" require an
// infinitive complement, verbs like "enjoy"/"avoid" require a gerund.
// Restricted to the curated ING_TO_BASE/BASE_TO_ING lookup so the
// reconstructed suggestion is always a real, correctly-spelled form instead
// of a guessed one (no blind "+ing"/"-ing" string surgery).
const INFINITIVE_ONLY_VERBS = ["want", "decide", "hope", "plan", "promise", "agree", "refuse", "offer", "manage", "afford", "fail", "expect", "learn"];
const GERUND_ONLY_VERBS = ["enjoy", "avoid", "finish", "suggest", "practice", "consider", "mind", "miss", "recommend", "admit", "deny", "postpone"];

const INFINITIVE_VERB_WANTS_GERUND_RE = new RegExp(
  `\\b(${INFINITIVE_ONLY_VERBS.join("|")})\\s+(${CONTINUOUS_VERBS_RE_FRAGMENT})\\b`,
  "i",
);
const GERUND_VERB_WANTS_INFINITIVE_RE = new RegExp(
  `\\b(${GERUND_ONLY_VERBS.join("|")})\\s+to\\s+(${Object.keys(BASE_TO_ING).join("|")})\\b`,
  "i",
);

function checkGerundInfinitive(text: string): CorrectionMatch | null {
  const wantsInfinitive = INFINITIVE_VERB_WANTS_GERUND_RE.exec(text);
  if (wantsInfinitive) {
    const verb = wantsInfinitive[1];
    const ing = wantsInfinitive[2].toLowerCase();
    const base = ING_TO_BASE[ing];
    return {
      patternKey: "infinitive_verb_used_with_gerund",
      category: "gerund_infinitive",
      confidence: "medium",
      explanation: `После «${verb}» обычно идёт инфинитив (to + глагол), а не форма на -ing.`,
      suggestion: `${verb} to ${base}`,
    };
  }

  const wantsGerund = GERUND_VERB_WANTS_INFINITIVE_RE.exec(text);
  if (wantsGerund) {
    const verb = wantsGerund[1];
    const base = wantsGerund[2].toLowerCase();
    const ing = BASE_TO_ING[base];
    return {
      patternKey: "gerund_verb_used_with_infinitive",
      category: "gerund_infinitive",
      confidence: "medium",
      explanation: `После «${verb}» обычно идёт форма на -ing (герундий), а не инфинитив с «to».`,
      suggestion: `${verb} ${ing}`,
    };
  }

  return null;
}

// Small closed vocabulary of words English learners frequently mistype, with
// a real edit-distance check (not just an exact regex) against each target
// — catches near-miss spellings that the fixed regexes above don't
// enumerate. Deliberately excludes "definitely"/"separate" — those already
// have exact-match rules in SPELLING_CONFUSIONS above, and including them
// here too would fire two overlapping matches for the same typo. Restricted
// to words of 5+ letters so short common words (where an edit distance of 1
// is far more likely to land on a *different real word*, not a typo) never
// trigger it — that's also why this stays "medium", not "high", confidence.
const EDIT_DISTANCE_TARGETS = [
  "necessary", "beginning", "business", "different", "government",
  "successful", "tomorrow", "address", "achieve", "argument",
  "calendar", "occurred",
];

// Optimal-string-alignment (Damerau-Levenshtein) distance — adds adjacent
// transposition as a single edit on top of plain insert/delete/substitute.
// Transposed letters ("buisness" for "business", "teh" for "the") are the
// single most common English-learner typo shape; plain Levenshtein would
// score those as distance 2 and miss them entirely at this function's
// distance-1 threshold.
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
}

function checkEditDistanceSpelling(text: string): CorrectionMatch | null {
  const words = text.match(/\b[a-zA-Z]+\b/g) ?? [];
  for (const rawWord of words) {
    const word = rawWord.toLowerCase();
    if (word.length < 5) continue;
    for (const target of EDIT_DISTANCE_TARGETS) {
      if (word === target) continue;
      if (Math.abs(word.length - target.length) > 1) continue;
      if (editDistance(word, target) === 1) {
        return {
          patternKey: `spelling_edit_distance_${target}`,
          category: "spelling",
          confidence: "medium",
          explanation: `«${rawWord}» похоже на опечатку в слове «${target}» (отличается на одну букву).`,
          suggestion: target,
        };
      }
    }
  }
  return null;
}

// M3 Slice 8 (Learning Paths v1, plan doc §4): three new, narrow, curated
// detections — only where a rule can be written as honestly/deterministically
// as the ones above. Conditionals and question-formation deliberately get
// NO correction-input rule in v1 (disclosed in the plan doc, not silently
// dropped) — they still get Knowledge Check/Mission coverage via
// grammar-bank.ts, just not free-text detection here.

// Modal + "to" — a common transfer error (mirrors the already-existing
// literal-translation style of PREPOSITION_RULES above): a modal verb
// directly followed by "to" before the main verb ("must to go").
const MODAL_PLUS_TO_RE = /\b(can|could|must|should|would|might|may)\s+to\s+(\w+)\b/i;

function checkModalPlusTo(text: string): CorrectionMatch | null {
  const match = MODAL_PLUS_TO_RE.exec(text);
  if (!match) return null;
  const modal = match[1];
  const verb = match[2];
  return {
    patternKey: "modal_plus_to",
    category: "modal",
    confidence: "high",
    explanation: `После модального глагола «${modal}» частица «to» не нужна.`,
    suggestion: `${modal} ${verb}`,
  };
}

// Double comparative ("more better", "more bigger") — "more" stacked on an
// adjective that's already in its -er/irregular comparative form. Closed
// list of common comparative forms, not general morphology.
const DOUBLE_COMPARATIVE_RE = /\bmore\s+(better|worse|bigger|faster|nicer|smaller|older|younger|taller|shorter|easier|harder|happier|colder|warmer)\b/i;

function checkDoubleComparative(text: string): CorrectionMatch | null {
  const match = DOUBLE_COMPARATIVE_RE.exec(text);
  if (!match) return null;
  const adjective = match[1];
  return {
    patternKey: "double_comparative",
    category: "comparative",
    confidence: "high",
    explanation: `«${adjective}» уже стоит в сравнительной степени — «more» перед ним лишнее.`,
    suggestion: adjective,
  };
}

// "which" used for a person instead of "who" — a common transfer error
// since some L1s don't distinguish person/thing relative pronouns. Closed
// list of common person nouns, matching the same narrow-vocabulary style as
// POSSESSIVE_PERSONS above (not a general person-noun detector).
const RELATIVE_WHICH_FOR_PERSON_RE = /\bthe\s+(man|woman|boy|girl|person|teacher|doctor|friend|student|driver|neighbor|neighbour)\s+which\b/i;

function checkRelativeWhichForPerson(text: string): CorrectionMatch | null {
  const match = RELATIVE_WHICH_FOR_PERSON_RE.exec(text);
  if (!match) return null;
  return {
    patternKey: "relative_which_for_person",
    category: "relative_clause",
    confidence: "medium",
    explanation: `Для людей используется относительное местоимение «who», не «which» — «the ${match[1]} which» лучше заменить на «the ${match[1]} who».`,
    suggestion: `the ${match[1]} who`,
  };
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

// Pure — no I/O, fully unit-testable. Returns supported=false only for
// input that can't be checked at all (empty, too long, no Latin letters) —
// never for "no known pattern matched", which is a legitimate clean result
// (the UI still tells the user this only covers known patterns, not a full
// grammar parse — see correction/page.tsx).
export function checkSentence(rawText: string): CorrectionResult {
  const text = normalize(rawText);

  if (text.length === 0) return { supported: false, matches: [] };
  if (text.length > MAX_INPUT_LENGTH) return { supported: false, matches: [] };
  if (!/[a-zA-Z]/.test(text)) return { supported: false, matches: [] };

  const matches: CorrectionMatch[] = [];

  const missingAux = checkMissingContinuousAux(text);
  if (missingAux) matches.push(missingAux);

  const beAgreement = checkBeAgreement(text);
  if (beAgreement) matches.push(beAgreement);

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

  const frontedAdverb = checkFrontedAdverb(text);
  if (frontedAdverb) matches.push(frontedAdverb);

  const passiveParticiple = checkPassiveWrongParticiple(text);
  if (passiveParticiple) matches.push(passiveParticiple);

  const gerundInfinitive = checkGerundInfinitive(text);
  if (gerundInfinitive) matches.push(gerundInfinitive);

  const modalPlusTo = checkModalPlusTo(text);
  if (modalPlusTo) matches.push(modalPlusTo);

  const doubleComparative = checkDoubleComparative(text);
  if (doubleComparative) matches.push(doubleComparative);

  const relativeWhichForPerson = checkRelativeWhichForPerson(text);
  if (relativeWhichForPerson) matches.push(relativeWhichForPerson);

  if (POSSESSION_HEURISTIC.re.test(text)) {
    matches.push({
      patternKey: POSSESSION_HEURISTIC.patternKey,
      category: "possession",
      confidence: "low",
      explanation: POSSESSION_HEURISTIC.explanation,
      suggestion: POSSESSION_HEURISTIC.suggestion,
    });
  }

  const possessiveMatch = POSSESSIVE_MISSING_APOSTROPHE_RE.exec(text);
  if (possessiveMatch) {
    const person = possessiveMatch[1];
    const noun = possessiveMatch[2];
    matches.push({
      patternKey: "possession_missing_apostrophe_s",
      category: "possession",
      confidence: "medium",
      explanation: `Похоже, пропущено притяжательное окончание «’s» — «my ${person} ${noun}» обычно нужно писать как «my ${person}'s ${noun}».`,
      suggestion: `my ${person}'s ${noun}`,
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

  const editDistanceSpelling = checkEditDistanceSpelling(text);
  if (editDistanceSpelling) matches.push(editDistanceSpelling);

  return { supported: true, matches };
}
