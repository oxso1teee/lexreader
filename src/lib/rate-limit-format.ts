// Отдельный файл без JSX специально ради юнит-теста через
// `node --experimental-strip-types` — он умеет стирать типы, но не умеет
// JSX, так что чистая логика форматирования не может жить в .tsx рядом с
// компонентом, если её нужно импортировать в тест напрямую.
export function formatRetryLabel(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return minutes > 0 ? `${minutes} мин ${String(seconds).padStart(2, "0")} сек` : `${seconds} сек`;
}
