import type { PatternCategory } from "@/lib/language-twin/types";

// M3 Slice 6 — deterministic, curated, versioned question bank for the
// Grammar Mission runner (plan doc §9). Reused verbatim by grammar_pattern,
// correction, diagnostic_followup, and maintenance missions — they only
// differ in which category they draw from and how many steps they use.
// No LLM, no free-text grading beyond exact/case-insensitive match — every
// question here targets a category the deterministic engine
// (correction-rules.ts / diagnostic.ts) can already honestly detect.
// Deliberately excludes spelling/collocation: those are edit-distance/exact-
// match detections on free text, not a natural multiple-choice practice
// shape, and stay correction-input-only.
export const GRAMMAR_BANK_VERSION = 1;

export interface GrammarQuestion {
  id: string;
  category: PatternCategory;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const GRAMMAR_QUESTION_BANK: GrammarQuestion[] = [
  // --- tense: missing auxiliary / be-agreement in Present Continuous ---
  { id: "tense_1", category: "tense", prompt: "I ___ cleaning my room.", options: ["am", "is", "are"], correctIndex: 0, explanation: "С «I» используется «am»." },
  { id: "tense_2", category: "tense", prompt: "She ___ studying English.", options: ["am", "is", "are"], correctIndex: 1, explanation: "С «she» используется «is»." },
  { id: "tense_3", category: "tense", prompt: "They ___ playing football.", options: ["am", "is", "are"], correctIndex: 2, explanation: "С «they» используется «are»." },
  { id: "tense_4", category: "tense", prompt: "He ___ working now.", options: ["am", "is", "are"], correctIndex: 1, explanation: "С «he» используется «is»." },
  { id: "tense_5", category: "tense", prompt: "We ___ having dinner.", options: ["am", "is", "are"], correctIndex: 2, explanation: "С «we» используется «are»." },
  { id: "tense_6", category: "tense", prompt: "You ___ reading a book right now.", options: ["am", "is", "are"], correctIndex: 2, explanation: "С «you» используется «are»." },
  { id: "tense_7", category: "tense", prompt: "It ___ raining outside.", options: ["am", "is", "are"], correctIndex: 1, explanation: "С «it» используется «is»." },
  { id: "tense_8", category: "tense", prompt: "My friends ___ watching a movie.", options: ["am", "is", "are"], correctIndex: 2, explanation: "Множественное число — «are»." },

  // --- article ---
  { id: "article_1", category: "article", prompt: "I need ___ advice.", options: ["a", "an", "the", "— (без артикля)"], correctIndex: 3, explanation: "«advice» неисчисляемое — без артикля." },
  { id: "article_2", category: "article", prompt: "She bought ___ apple.", options: ["a", "an", "the", "— (без артикля)"], correctIndex: 1, explanation: "«apple» начинается с гласного звука — «an»." },
  { id: "article_3", category: "article", prompt: "He is ___ best student in class.", options: ["a", "an", "the", "— (без артикля)"], correctIndex: 2, explanation: "Превосходная степень требует «the»." },
  { id: "article_4", category: "article", prompt: "I saw ___ dog in the park.", options: ["a", "an", "the", "— (без артикля)"], correctIndex: 0, explanation: "Впервые упомянутый исчисляемый объект — «a»." },
  { id: "article_5", category: "article", prompt: "Water is ___ essential for life.", options: ["a", "an", "the", "— (без артикля)"], correctIndex: 3, explanation: "Общее утверждение о неисчисляемом — без артикля." },
  { id: "article_6", category: "article", prompt: "This is ___ interesting book.", options: ["a", "an", "the", "— (без артикля)"], correctIndex: 1, explanation: "«interesting» начинается с гласного звука — «an»." },

  // --- preposition ---
  { id: "preposition_1", category: "preposition", prompt: "She is interested ___ art.", options: ["in", "at", "for", "of"], correctIndex: 0, explanation: "«interested in»." },
  { id: "preposition_2", category: "preposition", prompt: "It depends ___ the weather.", options: ["on", "of", "at", "in"], correctIndex: 0, explanation: "«depend on»." },
  { id: "preposition_3", category: "preposition", prompt: "He is married ___ a doctor.", options: ["to", "with", "for", "of"], correctIndex: 0, explanation: "«married to»." },
  { id: "preposition_4", category: "preposition", prompt: "I'm afraid ___ spiders.", options: ["of", "from", "at", "in"], correctIndex: 0, explanation: "«afraid of»." },
  { id: "preposition_5", category: "preposition", prompt: "We arrived ___ the airport early.", options: ["at", "in", "on", "to"], correctIndex: 0, explanation: "«arrive at» для конкретного места (аэропорт)." },
  { id: "preposition_6", category: "preposition", prompt: "She's good ___ math.", options: ["at", "in", "on", "for"], correctIndex: 0, explanation: "«good at»." },

  // --- possession ---
  { id: "possession_1", category: "possession", prompt: "This is ___ car.", options: ["my friend", "my friend's", "my friends"], correctIndex: 1, explanation: "Притяжательный падеж — «my friend's»." },
  { id: "possession_2", category: "possession", prompt: "That is ___ house.", options: ["my parents", "my parent's", "my parents'"], correctIndex: 2, explanation: "Множественное число во владении — апостроф после «s»: «my parents'»." },
  { id: "possession_3", category: "possession", prompt: "___ book is on the table.", options: ["The teacher", "The teacher's", "The teachers"], correctIndex: 1, explanation: "Притяжательный падеж — «the teacher's»." },
  { id: "possession_4", category: "possession", prompt: "I borrowed ___ laptop.", options: ["my sister", "my sisters", "my sister's"], correctIndex: 2, explanation: "Притяжательный падеж — «my sister's»." },
  { id: "possession_5", category: "possession", prompt: "Have you seen ___ new phone?", options: ["James", "James'", "James's"], correctIndex: 2, explanation: "Имя, оканчивающееся на «s», обычно всё равно получает «'s»." },

  // --- word_order ---
  { id: "word_order_1", category: "word_order", prompt: "Выбери верный порядок слов:", options: ["Yesterday I saw him.", "I yesterday saw him.", "Saw I him yesterday.", "I saw yesterday him."], correctIndex: 0, explanation: "Обстоятельство времени обычно в начале или конце, не между подлежащим и сказуемым." },
  { id: "word_order_2", category: "word_order", prompt: "Выбери верный порядок слов:", options: ["I always drink coffee in the morning.", "I drink always coffee in the morning.", "Always I drink coffee in the morning.", "I drink coffee always in the morning."], correctIndex: 0, explanation: "Наречие частотности «always» стоит перед основным глаголом, после подлежащего." },
  { id: "word_order_3", category: "word_order", prompt: "Выбери верный порядок слов:", options: ["She gave a beautiful gift to me.", "She gave to me a beautiful gift.", "A beautiful gift she gave to me.", "Gave she a beautiful gift to me."], correctIndex: 0, explanation: "Обычный порядок: подлежащее + глагол + дополнение + «to me»." },
  { id: "word_order_4", category: "word_order", prompt: "Выбери верный порядок слов:", options: ["Where do you live?", "Where you do live?", "Do you where live?", "You where do live?"], correctIndex: 0, explanation: "Вопросительное слово + вспомогательный глагол + подлежащее + смысловой глагол." },
  { id: "word_order_5", category: "word_order", prompt: "Выбери верный порядок слов:", options: ["I have never been to Japan.", "I have been never to Japan.", "Never I have been to Japan.", "I never have been to Japan."], correctIndex: 0, explanation: "«never» стоит между вспомогательным и смысловым глаголом." },

  // --- passive ---
  { id: "passive_1", category: "passive", prompt: "The book ___ by him.", options: ["was written", "was wrote", "is write", "written was"], correctIndex: 0, explanation: "После «was» нужна форма Past Participle — «written»." },
  { id: "passive_2", category: "passive", prompt: "The letter ___ yesterday.", options: ["was sent", "was send", "is sent", "sent was"], correctIndex: 0, explanation: "Прошедшее время пассива: «was» + Past Participle." },
  { id: "passive_3", category: "passive", prompt: "This house ___ in 1990.", options: ["was built", "was build", "is built", "built was"], correctIndex: 0, explanation: "«was built» — правильная форма пассива в прошедшем времени." },
  { id: "passive_4", category: "passive", prompt: "The window ___ by the wind.", options: ["was broken", "was broke", "is break", "broke was"], correctIndex: 0, explanation: "После «was» нужна форма Past Participle — «broken», не «broke»." },
  { id: "passive_5", category: "passive", prompt: "The cake ___ by my mother.", options: ["was made", "was make", "is making", "made was"], correctIndex: 0, explanation: "«was made» — пассив в прошедшем времени." },

  // --- gerund_infinitive ---
  { id: "gerund_1", category: "gerund_infinitive", prompt: "I enjoy ___ books.", options: ["read", "to read", "reading", "reads"], correctIndex: 2, explanation: "После «enjoy» используется герундий: «reading»." },
  { id: "gerund_2", category: "gerund_infinitive", prompt: "She wants ___ home early.", options: ["go", "to go", "going", "goes"], correctIndex: 1, explanation: "После «want» используется инфинитив: «to go»." },
  { id: "gerund_3", category: "gerund_infinitive", prompt: "He avoids ___ junk food.", options: ["eat", "to eat", "eating", "eats"], correctIndex: 2, explanation: "После «avoid» используется герундий: «eating»." },
  { id: "gerund_4", category: "gerund_infinitive", prompt: "We decided ___ a new car.", options: ["buy", "to buy", "buying", "buys"], correctIndex: 1, explanation: "После «decide» используется инфинитив: «to buy»." },
  { id: "gerund_5", category: "gerund_infinitive", prompt: "They finished ___ the project.", options: ["complete", "to complete", "completing", "completes"], correctIndex: 2, explanation: "После «finish» используется герундий: «completing»." },
];

// Deterministic, seeded selection — the same (category, seed) pair always
// returns the same questions in the same order, so a mission's shape is
// stable once generated (plan doc §17). Rotates the starting point through
// the bank using a cheap string hash of the seed rather than Math.random,
// which would make two identical generation calls produce different
// missions. Wraps around if count > the category's bank size.
function seedIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

export function buildGrammarQuestionSet(category: PatternCategory, count: number, seed: string): GrammarQuestion[] {
  const pool = GRAMMAR_QUESTION_BANK.filter((q) => q.category === category);
  if (pool.length === 0) return [];
  const start = seedIndex(seed, pool.length);
  const selected: GrammarQuestion[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    selected.push(pool[(start + i) % pool.length]);
  }
  return selected;
}

export const GRAMMAR_RUNNER_CATEGORIES: PatternCategory[] = [
  "tense",
  "article",
  "preposition",
  "possession",
  "word_order",
  "passive",
  "gerund_infinitive",
];
