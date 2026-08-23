// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 2,
// п.1 — готовые стартовые колоды A1-B2 по частотным спискам (NGSL).
// Предыдущая версия этого файла явно НЕ использовала NGSL ("вручную
// отобранный список... лицензированный датасет мы не тянем из
// непроверенного источника") — с тех пор проверили: NGSL 1.2 официально
// доступен под CC BY-SA 4.0 на newgeneralservicelist.com, легально можно
// использовать. Реальные данные лежат в ngsl-data.ts (2809 лемм, ranked by
// frequency); этот файл только банит их по CEFR-диапазонам и отсеивает
// служебные слова — сами слова нигде не выдуманы.
//
// NGSL официально НЕ разбит на CEFR-уровни (проверено на сайте проекта —
// это единый ranked-список). Деление на 4 примерно равных диапазона по
// рангу (по ~700 слов) — задокументированная в исследованиях по ELT
// эвристика "чем чаще слово, тем ниже уровень" (нередко цитируемое деление
// вида "top ~500 слов ≈ A1, следующие ~500 ≈ A2..." для похожих 6-уровневых
// шкал) применена здесь к 4 уровням A1-B2, которые уже поддерживает
// приложение — ranks 2101-2809 (последняя четверть списка) соответствуют
// верхней границе того, что NGSL вообще покрывает: список создан как раз
// для general/intermediate словаря, не для C1-C2 академической лексики
// (та идёт отдельными списками NAWL/BSL у того же проекта).
//
// Only "en" is a READY_LANGUAGES member (src/lib/languages.ts) — NGSL
// itself is inherently English-specific (that's literally what the "E" in
// the name is), and there's no equivalent open, similarly-licensed
// frequency list from the same project for the other 14 target languages
// this app lists — so, same as before this change, this stays English-only
// rather than inventing frequency data for languages that don't have one.
import { NGSL_WORDS } from "./ngsl-data.ts";

export type StarterLevel = "A1" | "A2" | "B1" | "B2";

export interface StarterDeckDef {
  level: StarterLevel;
  title: string;
  description: string;
  words: string[];
}

// Служебные слова (артикли, местоимения, предлоги, союзы, вспомогательные/
// модальные глаголы) намеренно исключены — тот же принцип, что был в
// предыдущей версии списка: MyMemory (перевод одного слова без контекста
// предложения) даёт для них мусор ("do" → "Древу,"), а как отдельные
// флэшкарты для запоминания они и не нужны — грамматика усваивается через
// чтение, не карточками "слово-перевод". Небольшие числительные (one, two…)
// осознанно НЕ в этом списке — это содержательная лексика, не служебная.
const FUNCTION_WORDS = new Set<string>(
  `
  a an the
  i you he she it we they me him her us them
  my your his its our their mine yours hers ours theirs
  myself yourself himself herself itself ourselves yourselves themselves
  this that these those
  who whom whose which what where when why how whoever whatever whichever
  in on at to from of for with by about against between into through during before after above below up down out off over under again further once as
  and or but nor so yet because although though while if unless since until whereas
  be am is are was were been being have has had having do does did doing done will would shall should can could may might must ought
  not no yes there here then than too very just only also even both either neither each every all some any none most more less few many much other another such own same
  `
    .split(/\s+/)
    .filter(Boolean),
);

// [start, end] инклюзивно, 1-based ранг — соответствует индексу в
// NGSL_WORDS минус 1.
const CEFR_RANK_BANDS: Record<StarterLevel, [number, number]> = {
  A1: [1, 700],
  A2: [701, 1400],
  B1: [1401, 2100],
  B2: [2101, 2809],
};

const WORDS_PER_DECK = 60;

function wordsForLevel(level: StarterLevel): string[] {
  const [start, end] = CEFR_RANK_BANDS[level];
  const picked: string[] = [];
  for (let rank = start; rank <= end && picked.length < WORDS_PER_DECK; rank++) {
    const word = NGSL_WORDS[rank - 1];
    if (word && !FUNCTION_WORDS.has(word)) picked.push(word);
  }
  return picked;
}

const LEVEL_META: Record<StarterLevel, { title: string; description: string }> = {
  A1: { title: "Старт A1", description: "60 самых частых слов английского (NGSL) — старт с нуля" },
  A2: { title: "Старт A2", description: "60 частых слов NGSL для простых бытовых разговоров и коротких текстов" },
  B1: { title: "Старт B1", description: "60 частых слов NGSL для повседневного общения на среднем уровне" },
  B2: { title: "Старт B2", description: "60 частых слов NGSL для уверенного среднего уровня и более сложных текстов" },
};

export const STARTER_DECKS: Record<StarterLevel, StarterDeckDef> = {
  A1: { level: "A1", ...LEVEL_META.A1, words: wordsForLevel("A1") },
  A2: { level: "A2", ...LEVEL_META.A2, words: wordsForLevel("A2") },
  B1: { level: "B1", ...LEVEL_META.B1, words: wordsForLevel("B1") },
  B2: { level: "B2", ...LEVEL_META.B2, words: wordsForLevel("B2") },
};
