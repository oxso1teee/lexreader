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
//
// M3 Slice 8 (Learning Paths v1, plan doc §4): version 2 closes two real
// gaps found during the Learning Paths audit — (1) `tense` used to be
// entirely Present Continuous (tense_1..8); Present Simple and Past Simple
// now get their own curated sets, distinguished by the new optional
// `subTopic` field so a Learning Paths Knowledge Check can scope to exactly
// one tense while ordinary Missions practice (no subTopic filter) still
// draws from all of them. (2) five new categories (comparative, modal,
// relative_clause, conditional, question_formation) — see
// GRAMMAR_RUNNER_CATEGORIES below.
export const GRAMMAR_BANK_VERSION = 2;

export interface GrammarQuestion {
  id: string;
  category: PatternCategory;
  /** Optional finer-grained scope within a category — e.g. "present_simple"
   *  vs "present_continuous" within "tense". Only Learning Paths' skill-
   *  scoped Knowledge Check filters on this; Missions' buildGrammarQuestionSet
   *  calls omit it and draw from the whole category as before. */
  subTopic?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const GRAMMAR_QUESTION_BANK: GrammarQuestion[] = [
  // --- tense: missing auxiliary / be-agreement in Present Continuous ---
  { id: "tense_1", category: "tense", subTopic: "present_continuous", prompt: "I ___ cleaning my room.", options: ["am", "is", "are"], correctIndex: 0, explanation: "С «I» используется «am»." },
  { id: "tense_2", category: "tense", subTopic: "present_continuous", prompt: "She ___ studying English.", options: ["am", "is", "are"], correctIndex: 1, explanation: "С «she» используется «is»." },
  { id: "tense_3", category: "tense", subTopic: "present_continuous", prompt: "They ___ playing football.", options: ["am", "is", "are"], correctIndex: 2, explanation: "С «they» используется «are»." },
  { id: "tense_4", category: "tense", subTopic: "present_continuous", prompt: "He ___ working now.", options: ["am", "is", "are"], correctIndex: 1, explanation: "С «he» используется «is»." },
  { id: "tense_5", category: "tense", subTopic: "present_continuous", prompt: "We ___ having dinner.", options: ["am", "is", "are"], correctIndex: 2, explanation: "С «we» используется «are»." },
  { id: "tense_6", category: "tense", subTopic: "present_continuous", prompt: "You ___ reading a book right now.", options: ["am", "is", "are"], correctIndex: 2, explanation: "С «you» используется «are»." },
  { id: "tense_7", category: "tense", subTopic: "present_continuous", prompt: "It ___ raining outside.", options: ["am", "is", "are"], correctIndex: 1, explanation: "С «it» используется «is»." },
  { id: "tense_8", category: "tense", subTopic: "present_continuous", prompt: "My friends ___ watching a movie.", options: ["am", "is", "are"], correctIndex: 2, explanation: "Множественное число — «are»." },

  // --- tense: Present Simple ---
  { id: "tense_ps_1", category: "tense", subTopic: "present_simple", prompt: "She ___ to work every day.", options: ["go", "goes", "going"], correctIndex: 1, explanation: "С «she» в Present Simple добавляется «-s»: goes." },
  { id: "tense_ps_2", category: "tense", subTopic: "present_simple", prompt: "I ___ coffee every morning.", options: ["drink", "drinks", "drinking"], correctIndex: 0, explanation: "С «I» окончание «-s» не добавляется." },
  { id: "tense_ps_3", category: "tense", subTopic: "present_simple", prompt: "They ___ football on Sundays.", options: ["play", "plays", "playing"], correctIndex: 0, explanation: "«They» — множественное число, без «-s»." },
  { id: "tense_ps_4", category: "tense", subTopic: "present_simple", prompt: "He ___ not like coffee.", options: ["do", "does", "doing"], correctIndex: 1, explanation: "Отрицание для he/she/it строится через «doesn't»/«does not»." },
  { id: "tense_ps_5", category: "tense", subTopic: "present_simple", prompt: "___ you speak English?", options: ["Do", "Does", "Are"], correctIndex: 0, explanation: "Вопрос для «you» строится через «Do»." },
  { id: "tense_ps_6", category: "tense", subTopic: "present_simple", prompt: "Water ___ at 100°C.", options: ["boil", "boils", "boiling"], correctIndex: 1, explanation: "Общий факт — Present Simple, «water» = it, добавляется «-s»." },

  // --- tense: Past Simple ---
  { id: "tense_pst_1", category: "tense", subTopic: "past_simple", prompt: "I ___ to the cinema yesterday.", options: ["go", "went", "goes"], correctIndex: 1, explanation: "«go» — неправильный глагол, прошедшая форма «went»." },
  { id: "tense_pst_2", category: "tense", subTopic: "past_simple", prompt: "She ___ her homework last night.", options: ["finish", "finished", "finishes"], correctIndex: 1, explanation: "Правильный глагол — «+ed» в прошедшем времени." },
  { id: "tense_pst_3", category: "tense", subTopic: "past_simple", prompt: "They ___ not come to the party.", options: ["did", "does", "do"], correctIndex: 0, explanation: "Отрицание в прошедшем — «didn't»/«did not» для всех лиц." },
  { id: "tense_pst_4", category: "tense", subTopic: "past_simple", prompt: "___ you see that movie?", options: ["Do", "Did", "Does"], correctIndex: 1, explanation: "Вопрос в прошедшем времени — вспомогательный «did»." },
  { id: "tense_pst_5", category: "tense", subTopic: "past_simple", prompt: "We ___ dinner at 7 pm yesterday.", options: ["have", "had", "has"], correctIndex: 1, explanation: "«have» — неправильный глагол, прошедшая форма «had»." },
  { id: "tense_pst_6", category: "tense", subTopic: "past_simple", prompt: "He ___ his keys at home this morning.", options: ["forgot", "forgets", "forgetted"], correctIndex: 0, explanation: "«forget» — неправильный глагол: forget → forgot." },

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

  // --- comparative ---
  { id: "comparative_1", category: "comparative", prompt: "This book is ___ than that one.", options: ["more interesting", "interestinger", "most interesting"], correctIndex: 0, explanation: "Многосложные прилагательные образуют сравнительную степень через «more», не через суффикс." },
  { id: "comparative_2", category: "comparative", prompt: "My car is ___ than yours.", options: ["fast", "faster", "more fast"], correctIndex: 1, explanation: "Короткие прилагательные (1 слог) — через «-er»: fast → faster." },
  { id: "comparative_3", category: "comparative", prompt: "She is the ___ student in the class.", options: ["good", "better", "best"], correctIndex: 2, explanation: "Превосходная степень неправильного прилагательного «good» — «best», не «goodest»." },
  { id: "comparative_4", category: "comparative", prompt: "This exercise is ___ than the last one.", options: ["easy", "easier", "more easy"], correctIndex: 1, explanation: "«easy» → «easier» (y меняется на ier)." },
  { id: "comparative_5", category: "comparative", prompt: "London is ___ than Paris in winter.", options: ["cold", "colder", "more colder"], correctIndex: 1, explanation: "«more colder» — двойная сравнительная степень, лишнее «more»." },
  { id: "comparative_6", category: "comparative", prompt: "He is the ___ person I know.", options: ["funny", "funnier", "funniest"], correctIndex: 2, explanation: "Превосходная степень: funny → funniest." },

  // --- modal ---
  { id: "modal_1", category: "modal", prompt: "You ___ see a doctor if you feel sick.", options: ["must", "must to", "musts"], correctIndex: 0, explanation: "После модального глагола «must» не ставится «to»." },
  { id: "modal_2", category: "modal", prompt: "___ you help me with this bag?", options: ["Can", "Cans", "Canning"], correctIndex: 0, explanation: "«can» не изменяется по лицам и не принимает «to»." },
  { id: "modal_3", category: "modal", prompt: "She ___ speak three languages.", options: ["can", "cans", "can to"], correctIndex: 0, explanation: "Модальный глагол «can» одинаков для всех лиц: she can, не she cans." },
  { id: "modal_4", category: "modal", prompt: "We ___ finish this by Friday.", options: ["should", "should to", "shoulds"], correctIndex: 0, explanation: "После «should» сразу идёт глагол без «to»: should finish." },
  { id: "modal_5", category: "modal", prompt: "You ___ smoke here — it's not allowed.", options: ["mustn't", "don't must", "no must"], correctIndex: 0, explanation: "Отрицание модального глагола — «mustn't», не «don't must»." },
  { id: "modal_6", category: "modal", prompt: "I ___ swim when I was five.", options: ["could", "could to", "cans"], correctIndex: 0, explanation: "«could» — прошедшая форма «can», тоже без «to»." },

  // --- relative_clause ---
  { id: "relative_1", category: "relative_clause", prompt: "The woman ___ lives next door is a doctor.", options: ["which", "who", "whom"], correctIndex: 1, explanation: "Для людей используется «who», не «which»." },
  { id: "relative_2", category: "relative_clause", prompt: "The book ___ I bought yesterday is great.", options: ["who", "which", "whom"], correctIndex: 1, explanation: "Для предметов используется «which» или «that», не «who»." },
  { id: "relative_3", category: "relative_clause", prompt: "This is the house ___ I grew up.", options: ["which", "where", "who"], correctIndex: 1, explanation: "Для места используется «where»." },
  { id: "relative_4", category: "relative_clause", prompt: "The man ___ car was stolen called the police.", options: ["who", "whose", "which"], correctIndex: 1, explanation: "«whose» показывает принадлежность." },
  { id: "relative_5", category: "relative_clause", prompt: "Выбери верное предложение:", options: ["The book which I bought it was expensive.", "The book which I bought was expensive.", "The book I bought it was expensive."], correctIndex: 1, explanation: "После «which» не нужно повторять местоимение «it» — оно уже относится к «book»." },
  { id: "relative_6", category: "relative_clause", prompt: "The teacher ___ helped me is very kind.", options: ["which", "who", "whose"], correctIndex: 1, explanation: "Для людей используется «who»." },

  // --- conditional ---
  { id: "conditional_1", category: "conditional", prompt: "If it rains, I ___ stay home.", options: ["will", "would", "stay"], correctIndex: 0, explanation: "Первый тип условных: if + Present Simple, will + инфинитив." },
  { id: "conditional_2", category: "conditional", prompt: "If I ___ rich, I would travel the world.", options: ["am", "was", "were"], correctIndex: 2, explanation: "Второй тип (нереальное условие): «if I were» — «were» для всех лиц в этой конструкции." },
  { id: "conditional_3", category: "conditional", prompt: "If she studied harder, she ___ pass the exam.", options: ["will", "would", "passed"], correctIndex: 1, explanation: "Второй тип: if + Past Simple, would + инфинитив." },
  { id: "conditional_4", category: "conditional", prompt: "If you heat water to 100°C, it ___.", options: ["will boil", "would boil", "boils"], correctIndex: 2, explanation: "Нулевой тип (общие истины): if + Present Simple, Present Simple." },
  { id: "conditional_5", category: "conditional", prompt: "If I had known, I ___ have helped you.", options: ["will", "would", "would have"], correctIndex: 2, explanation: "Третий тип (прошлое нереальное): if + Past Perfect, would have + Past Participle." },
  { id: "conditional_6", category: "conditional", prompt: "___ it snows tomorrow, we'll build a snowman.", options: ["If", "Unless", "When"], correctIndex: 0, explanation: "Простое условие — «if»." },

  // --- question_formation ---
  { id: "question_1", category: "question_formation", prompt: "___ do you live?", options: ["Where", "Were", "Which"], correctIndex: 0, explanation: "Вопросительное слово «where» для места." },
  { id: "question_2", category: "question_formation", prompt: "___ is your name?", options: ["What", "Who", "Where"], correctIndex: 0, explanation: "«What» для запроса информации/имени." },
  { id: "question_3", category: "question_formation", prompt: "Выбери верный вопрос:", options: ["You are from where?", "Where are you from?", "Where you are from?"], correctIndex: 1, explanation: "Порядок: вопросительное слово + вспомогательный глагол + подлежащее." },
  { id: "question_4", category: "question_formation", prompt: "___ does she work?", options: ["Where", "Were", "Was"], correctIndex: 0, explanation: "«Does» — вспомогательный глагол для she/he/it в Present Simple." },
  { id: "question_5", category: "question_formation", prompt: "How many books ___ you read last year?", options: ["do", "did", "does"], correctIndex: 1, explanation: "Прошедшее время — вспомогательный «did»." },
  { id: "question_6", category: "question_formation", prompt: "___ is coming to the party?", options: ["Who", "Whom", "Whose"], correctIndex: 0, explanation: "«Who» как подлежащее вопроса." },
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

// subTopic is optional and additive (plan doc §4/§8): Missions' own calls
// never pass it and keep drawing from the whole category exactly as before;
// only Learning Paths' skill-scoped Knowledge Check narrows to one subTopic
// (e.g. "present_simple") when a category has more than one.
export function buildGrammarQuestionSet(category: PatternCategory, count: number, seed: string, subTopic?: string): GrammarQuestion[] {
  const pool = GRAMMAR_QUESTION_BANK.filter((q) => q.category === category && (!subTopic || q.subTopic === subTopic));
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
  "comparative",
  "modal",
  "relative_clause",
  "conditional",
  "question_formation",
];
