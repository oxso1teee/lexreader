// Вопросы теста уровня — предложение с пропуском («I ___ in London…») или
// инструкция без пропуска («Выбери верный порядок слов:»). Разбор вынесен в
// чистую функцию: экран рисует пропуск плиткой, а не голыми подчёркиваниями, и
// это тестируется без React.
export interface PromptGap {
  before: string;
  after: string;
}

/** Делит промпт по первому пропуску из двух и более «_»; null — пропуска нет. */
export function splitAtGap(prompt: string): PromptGap | null {
  const match = /_{2,}/.exec(prompt);
  if (!match) return null;
  return { before: prompt.slice(0, match.index), after: prompt.slice(match.index + match[0].length) };
}
