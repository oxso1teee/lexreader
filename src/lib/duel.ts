import { NGSL_WORDS } from "./ngsl-data.ts";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Живые дуэли по словарю 1 на 1". Живая проверка: Supabase Realtime уже
// часть стека (config.toml [realtime] enabled=true, @supabase/supabase-js
// уже включает realtime-клиент) — новой инфраструктуры не заводим.
// Случайный оппонент требует живого пула одновременно ищущих игроков,
// которого у проекта пока нет (0 realtime-фич до этой) — честный MVP:
// только "пригласи друга по ссылке", без matchmaking-очереди, которая
// будет пустовать.
//
// Вся модель безопасности/приватности — supabase/migrations/0050_vocabulary_duels.sql
// (SECURITY DEFINER-функции, тот же принцип, что и get_weekly_leaderboard
// из PR #44 — приватность обеспечена тем, ЧТО возвращает функция, не тем,
// что доверено вызывающему). correct_answer/латентность/античит целиком
// на сервере — этот файл содержит только чистые, тестируемые без БД
// функции (выбор слов, перемешивание вариантов, сообщения об ошибках) и
// тонкие обёртки над RPC.

// Зеркалирует public.duel_round_time_limit_ms() в миграции — нет способа
// буквально разделить одну константу между SQL и TS.
export const DUEL_ROUND_TIME_LIMIT_MS = 10_000;
export const DUEL_OPTION_COUNT = 4;
export const DEFAULT_DUEL_ROUND_COUNT = 7;

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Раздел C, Тир 3 — "не давать никому вопрос из его же персональной
// колоды... например, тот же NGSL-датасет из PR #39". NGSL — системный,
// одинаковый для обоих дуэлянтов список, ничья личная колода никогда не
// участвует. usedWords — слова уже сыгранных раундов ЭТОЙ дуэли, чтобы не
// повторяться внутри одной игры.
export function pickNextDuelWord(usedWords: ReadonlySet<string>, pool: readonly string[] = NGSL_WORDS): string | null {
  const available = pool.filter((w) => !usedWords.has(w));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)] ?? null;
}

// Дистракторы — другие случайные слова того же NGSL-пула (переводятся тем
// же cachedTranslate, что и правильный ответ — см. src/app/(app)/duel/actions.ts),
// никогда не переизобретённые/выдуманные варианты.
export function pickDistractorWords(
  excludeWords: ReadonlySet<string>,
  count: number,
  pool: readonly string[] = NGSL_WORDS,
): string[] {
  const available = pool.filter((w) => !excludeWords.has(w));
  return shuffle(available).slice(0, count);
}

export interface DuelRoundContent {
  word: string;
  correctAnswer: string;
  options: string[];
}

// Собирает финальный payload для deal_duel_round(): правильный ответ +
// дистракторы перемешаны вместе — сервер (SQL-функция) всё равно не
// доверяет тому, какой из options "правильный" клиенту, но UI должен их
// получить уже перемешанными, чтобы правильный вариант не был всегда
// первым.
export function buildDuelRoundContent(word: string, correctTranslation: string, distractorTranslations: string[]): DuelRoundContent {
  const options = shuffle([correctTranslation, ...distractorTranslations]);
  return { word, correctAnswer: correctTranslation, options };
}

// Единая точка перевода SQL-кодов ошибок (0050_vocabulary_duels.sql —
// каждый raise exception message) в понятный русский текст. Держим
// сообщения в SQL машинно-читаемыми (snake_case), русский текст — только
// здесь, тестируется без БД.
const DUEL_ERROR_MESSAGES: Record<string, string> = {
  invalid_round_count: "Некорректное число раундов.",
  profile_not_found: "Не удалось найти профиль — попробуй перезайти.",
  language_not_supported: "Дуэли пока доступны только для изучающих английский.",
  duel_not_found: "Дуэль не найдена — возможно, ссылка неверна.",
  duel_not_active: "Эта дуэль уже завершена.",
  duel_not_joinable: "Эта дуэль уже началась или недоступна для присоединения.",
  cannot_join_own_duel: "Нельзя присоединиться к своей же дуэли — пришли ссылку другу.",
  language_mismatch: "Нужно изучать тот же язык, что и создатель дуэли.",
  not_a_participant: "У тебя нет доступа к этой дуэли.",
  already_answered: "Ты уже ответил в этом раунде.",
  round_not_found: "Раунд не найден.",
  round_not_timed_out_yet: "Раунд ещё не истёк.",
  invalid_options: "Некорректные варианты ответа.",
  correct_answer_not_in_options: "Правильный ответ не входит в варианты.",
};

export function describeDuelError(rawMessage: string | null | undefined): string {
  if (!rawMessage) return "Что-то пошло не так, попробуй ещё раз.";
  return DUEL_ERROR_MESSAGES[rawMessage] ?? "Что-то пошло не так, попробуй ещё раз.";
}

// === Типы, зеркалирующие JSON-форму get_duel_state() (0050_vocabulary_duels.sql) ===
export interface DuelAnswerView {
  answer: string;
  isCorrect: boolean;
  latencyMs: number;
}

export interface DuelRoundView {
  index: number;
  word: string;
  options: string[];
  startedAt: string;
  resolvedAt: string | null;
  correctAnswer: string | null;
  myAnswer: DuelAnswerView | null;
  opponentAnswered: boolean;
  opponentAnswer: DuelAnswerView | null;
}

export interface DuelState {
  id: string;
  status: "waiting" | "active" | "finished";
  language: string;
  roundCount: number;
  currentRoundIndex: number;
  creatorInitials: string;
  opponentInitials: string | null;
  creatorScore: number;
  opponentScore: number;
  isCreator: boolean;
  isParticipant: boolean;
  winnerIsMe: boolean;
  isDraw: boolean;
  round?: DuelRoundView;
}
