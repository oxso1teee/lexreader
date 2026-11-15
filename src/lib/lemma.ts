// Reading Engine R1 — сопоставление словоформ с сохранёнными словами (английский).
//
// Читалка раньше сравнивала слова текста с vocabulary_items.headword только по точной
// строке: «walked» и «walk» считались разными словами, поэтому подсветка, доля «знакомых»
// слов и статистика текста занижали известное. Здесь — детерминированные правила без
// внешних зависимостей и без БД.
//
// Это именно СОПОСТАВЛЕНИЕ, а не слияние: сохранение слова по-прежнему идёт по точной форме
// (у «went» и «go» разные переводы и контексты), а база не меняется. Поэтому ложное
// совпадение ограничено подсветкой, а точное совпадение всегда важнее приблизительного.
//
// Правила порождают КАНДИДАТОВ базовой формы (в том числе несуществующих, например
// «walke»): кандидат учитывается, только если совпадёт с реально сохранённым словом.

/** Неправильные формы → базовая форма. */
const IRREGULAR: Readonly<Record<string, string>> = {
  am: "be", is: "be", are: "be", was: "be", were: "be", been: "be", being: "be",
  has: "have", had: "have", having: "have",
  does: "do", did: "do", done: "do", doing: "do",
  goes: "go", went: "go", gone: "go", going: "go",
  said: "say", says: "say",
  made: "make", makes: "make",
  took: "take", taken: "take", takes: "take",
  came: "come", comes: "come",
  saw: "see", seen: "see", sees: "see",
  knew: "know", known: "know", knows: "know",
  got: "get", gotten: "get", gets: "get",
  gave: "give", given: "give", gives: "give",
  found: "find", finds: "find",
  thought: "think", thinks: "think",
  told: "tell", tells: "tell",
  became: "become", becomes: "become",
  left: "leave", leaves: "leave",
  felt: "feel", feels: "feel",
  brought: "bring", brings: "bring",
  began: "begin", begun: "begin", begins: "begin",
  kept: "keep", keeps: "keep",
  held: "hold", holds: "hold",
  wrote: "write", written: "write", writes: "write",
  stood: "stand", stands: "stand",
  heard: "hear", hears: "hear",
  meant: "mean", means: "mean",
  met: "meet", meets: "meet",
  ran: "run", runs: "run",
  paid: "pay", pays: "pay",
  sat: "sit", sits: "sit",
  spoke: "speak", spoken: "speak", speaks: "speak",
  led: "lead", leads: "lead",
  grew: "grow", grown: "grow", grows: "grow",
  lost: "lose", loses: "lose",
  fell: "fall", fallen: "fall", falls: "fall",
  sent: "send", sends: "send",
  built: "build", builds: "build",
  understood: "understand", understands: "understand",
  drew: "draw", drawn: "draw", draws: "draw",
  broke: "break", broken: "break", breaks: "break",
  spent: "spend", spends: "spend",
  rose: "rise", risen: "rise", rises: "rise",
  drove: "drive", driven: "drive", drives: "drive",
  bought: "buy", buys: "buy",
  wore: "wear", worn: "wear", wears: "wear",
  chose: "choose", chosen: "choose", chooses: "choose",
  ate: "eat", eaten: "eat", eats: "eat",
  sang: "sing", sung: "sing",
  swam: "swim", swum: "swim",
  slept: "sleep", sleeps: "sleep",
  taught: "teach", teaches: "teach",
  caught: "catch", catches: "catch",
  fought: "fight",
  sold: "sell", sells: "sell",
  won: "win", wins: "win",
  children: "child",
  men: "man",
  women: "woman",
  feet: "foot",
  teeth: "tooth",
  mice: "mouse",
  better: "good", best: "good",
  worse: "bad", worst: "bad",
};

/** Слова на «-s», которые не являются множественным числом/3-м лицом. */
const NOT_PLURAL: ReadonlySet<string> = new Set([
  "news", "always", "perhaps", "series", "species", "physics", "mathematics", "economics",
  "politics", "athletics", "this", "his", "its", "yes", "thus", "plus", "bus", "gas", "lens",
  "across", "less", "unless", "whereas", "towards", "afterwards", "sometimes", "besides",
  "chaos", "bias", "canvas", "atlas", "pancreas", "christmas",
]);

const MIN_STEM = 3;
const VOWELS = /[aeiou]/;

function undouble(stem: string): string | null {
  const n = stem.length;
  if (n >= MIN_STEM + 1 && stem[n - 1] === stem[n - 2] && !VOWELS.test(stem[n - 1])) {
    return stem.slice(0, -1);
  }
  return null;
}

function stemCandidates(stem: string): string[] {
  if (stem.length < MIN_STEM) return [];
  const out = [stem, `${stem}e`];
  const single = undouble(stem);
  if (single) out.push(single);
  return out;
}

/** Нормализация для сравнения: нижний регистр, типографский апостроф → прямой. */
export function normalizeForm(word: string): string {
  return word.toLowerCase().replace(/[’‘]/g, "'");
}

/**
 * Возможные базовые формы английского слова (без самого слова), в порядке убывания уверенности.
 * Для не-английских языков, слов с апострофом/дефисом и слишком коротких слов — пустой список.
 */
export function baseFormCandidates(word: string, language = "en"): string[] {
  if (language !== "en") return [];
  const w = normalizeForm(word);
  if (!/^[a-z]+$/.test(w) || w.length < 3) return [];

  const irregular = IRREGULAR[w];
  if (irregular) return [irregular];

  const out: string[] = [];
  const add = (c: string) => {
    if (c !== w && c.length >= MIN_STEM && !out.includes(c)) out.push(c);
  };

  if (w.endsWith("ies") && w.length > 4) add(`${w.slice(0, -3)}y`);
  if (w.endsWith("ied") && w.length > 4) add(`${w.slice(0, -3)}y`);
  if (w.endsWith("ing") && w.length > 5) stemCandidates(w.slice(0, -3)).forEach(add);
  if (w.endsWith("ed") && w.length > 4) stemCandidates(w.slice(0, -2)).forEach(add);
  if (w.endsWith("es") && w.length > 4) add(w.slice(0, -2));
  if (
    w.endsWith("s") && w.length > 3 && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is") && !NOT_PLURAL.has(w)
  ) {
    add(w.slice(0, -1));
  }
  if (w.endsWith("ier") && w.length > 4) add(`${w.slice(0, -3)}y`);
  if (w.endsWith("iest") && w.length > 5) add(`${w.slice(0, -4)}y`);
  if (w.endsWith("er") && w.length > 4) stemCandidates(w.slice(0, -2)).forEach(add);
  if (w.endsWith("est") && w.length > 5) stemCandidates(w.slice(0, -3)).forEach(add);
  if (w.endsWith("ly") && w.length > 4) add(w.slice(0, -2));

  return out;
}

export interface FormMatch<T> {
  /** Ключ исходного словаря, на который указало совпадение. */
  key: string;
  value: T;
}

/**
 * Индекс сохранённых слов для поиска по словоформе. Приоритет совпадений:
 * 1) точная форма; 2) базовая форма токена = сохранённое слово («walked» → «walk»);
 * 3) токен = базовая форма сохранённой формы («walk» ← сохранено «walked»);
 * 4) токен и сохранённая форма имеют общую базу («gone» ↔ сохранено «went»).
 */
export function createFormIndex<T>(entries: Readonly<Record<string, T>>, language = "en") {
  const exact = new Map<string, FormMatch<T>>();
  const derived = new Map<string, FormMatch<T>>();
  for (const [rawKey, value] of Object.entries(entries)) {
    const key = normalizeForm(rawKey);
    if (!exact.has(key)) exact.set(key, { key: rawKey, value });
  }
  for (const [rawKey, value] of Object.entries(entries)) {
    for (const base of baseFormCandidates(rawKey, language)) {
      if (!exact.has(base) && !derived.has(base)) derived.set(base, { key: rawKey, value });
    }
  }
  return {
    /** Запись, соответствующая слову, или null. */
    find(word: string): FormMatch<T> | null {
      const w = normalizeForm(word);
      const direct = exact.get(w);
      if (direct) return direct;
      const bases = baseFormCandidates(w, language);
      for (const base of bases) {
        const hit = exact.get(base);
        if (hit) return hit;
      }
      const sameBase = derived.get(w);
      if (sameBase) return sameBase;
      // обе формы — производные от одной базы: «gone» (→ go) и сохранённое «went» (→ go)
      for (const base of bases) {
        const hit = derived.get(base);
        if (hit) return hit;
      }
      return null;
    },
  };
}
