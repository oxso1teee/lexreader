// Обложки системных текстов — детерминированный градиент по заголовку,
// без картинок-ассетов и без генерации ИИ (docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 4).

const PALETTE: [string, string][] = [
  ["#2f5d50", "#1f3f37"],
  ["#a8451f", "#7a3016"],
  ["#9c7526", "#6f5518"],
  ["#4a4a6a", "#2e2e46"],
  ["#1f5750", "#163e39"],
  ["#8a3819", "#5e2610"],
];

const TOPIC_EMOJI: Record<string, string> = {
  coffee: "☕",
  river: "🌊",
  lake: "🌊",
  friend: "🤝",
  cat: "🐱",
  letter: "✉️",
  neighbor: "🏘️",
  airport: "✈️",
  bookshop: "📚",
  cooking: "🍲",
  city: "🏙️",
  room: "🔍",
  train: "🚆",
  job: "💼",
  interview: "💼",
  rain: "🌧️",
  house: "🏚️",
  hill: "🏚️",
};

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverGradient(title: string): [string, string] {
  return PALETTE[hashString(title) % PALETTE.length];
}

export function coverEmoji(title: string): string {
  const lower = title.toLowerCase();
  const key = Object.keys(TOPIC_EMOJI).find((k) => lower.includes(k));
  return key ? TOPIC_EMOJI[key] : "📄";
}
