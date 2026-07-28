// Задача 97: готовые стартовые колоды по уровням CEFR для английского.
// Это НЕ импортированный файл NGSL (лицензированный датасет мы не тянем
// из непроверенного источника) — это вручную отобранный список
// высокочастотных английских слов по уровням, тот же принцип "готовая
// колода по частотности", что и у конкурента. Перевод на native_language
// пользователя считается на лету через существующий translateText() при
// добавлении колоды — см. brain/starter-deck-actions.ts.

export type StarterLevel = "A1" | "A2" | "B1" | "B2";

export interface StarterDeckDef {
  level: StarterLevel;
  title: string;
  description: string;
  words: string[];
}

export const STARTER_DECKS: Record<StarterLevel, StarterDeckDef> = {
  A1: {
    level: "A1",
    title: "Старт A1",
    description: "60 базовых слов для самого начала — предметы, семья, простые глаголы",
    // Служебные слова (артикли, местоимения, вспомогательные глаголы вроде
    // "a"/"is"/"do") намеренно исключены — переводчик по памяти переводов
    // (MyMemory) без контекста предложения даёт для них мусор ("do" →
    // "Древу,"), а как отдельные флэшкарты для запоминания они и не нужны:
    // грамматика усваивается через чтение, а не карточками "слово-перевод".
    words: [
      "dog", "cat", "sun", "moon", "red", "blue", "green", "black", "white", "mother",
      "father", "sister", "brother", "morning", "evening", "week", "went", "come", "see", "look",
      "want", "like", "good", "bad", "big", "small", "hot", "cold", "new", "old",
      "day", "night", "time", "year", "man", "woman", "child", "friend", "family", "house",
      "school", "food", "water", "book", "car", "money", "work", "name", "world", "yes",
      "no", "please", "thank you", "hello", "goodbye", "one", "two", "three", "four", "ten",
    ],
  },
  A2: {
    level: "A2",
    title: "Старт A2",
    description: "60 слов для простых бытовых разговоров и коротких текстов",
    words: [
      "because", "before", "after", "always", "never", "sometimes", "usually", "often", "again", "already",
      "believe", "understand", "remember", "forget", "explain", "decide", "hope", "wish", "try", "learn",
      "teach", "buy", "sell", "pay", "spend", "save", "borrow", "lend", "travel", "arrive",
      "leave", "return", "visit", "meet", "invite", "enjoy", "worry", "afraid", "angry", "surprised",
      "tired", "hungry", "thirsty", "healthy", "ill", "weather", "season", "holiday", "journey", "airport",
      "hotel", "restaurant", "shop", "market", "price", "cheap", "expensive", "quality", "customer", "neighbor",
    ],
  },
  B1: {
    level: "B1",
    title: "Старт B1",
    description: "60 слов для повседневного общения на среднем уровне",
    words: [
      "achieve", "improve", "increase", "decrease", "develop", "create", "produce", "provide", "require", "suggest",
      "recommend", "consider", "compare", "describe", "discuss", "argue", "agree", "disagree", "admit", "avoid",
      "manage", "afford", "prevent", "solve", "notice", "realize", "recognize", "expect", "assume", "guess",
      "opportunity", "experience", "advantage", "disadvantage", "challenge", "achievement", "opinion", "attitude", "behavior", "relationship",
      "environment", "society", "community", "government", "economy", "industry", "technology", "equipment", "material", "resource",
      "responsible", "confident", "curious", "generous", "patient", "polite", "reliable", "independent", "flexible", "ambitious",
    ],
  },
  B2: {
    level: "B2",
    title: "Старт B2",
    description: "60 слов для уверенного среднего уровня и более сложных текстов",
    words: [
      "acknowledge", "anticipate", "accumulate", "accomplish", "advocate", "allocate", "assess", "conclude", "constitute", "contribute",
      "demonstrate", "determine", "distinguish", "emphasize", "establish", "estimate", "evaluate", "facilitate", "highlight", "identify",
      "illustrate", "implement", "imply", "indicate", "interpret", "justify", "maintain", "obtain", "occur", "perceive",
      "persuade", "pursue", "reveal", "significant", "substantial", "sufficient", "consistent", "controversial", "inevitable", "plausible",
      "ambiguous", "arbitrary", "coherent", "comprehensive", "conventional", "dominant", "explicit", "implicit", "innovative", "legitimate",
      "prevailing", "subsequent", "underlying", "versatile", "circumstance", "consequence", "phenomenon", "perspective", "framework", "hypothesis",
    ],
  },
};
