// Обложки текстов — детерминированный градиент по заголовку, без
// картинок-ассетов и без генерации ИИ (docs/IMPLEMENTATION_PROMPT_2026-07-28.md,
// раздел 4). M3 Slice 3: палитра приведена в один тон с новым forest-green
// акцентом Library/Reader (docs/ui/m3-slice3-library-reader-plan.md) — та же
// подборка оттенков, что использовалась в approved artifact.

const PALETTE: [string, string][] = [
  ["#2c6b4f", "#1f4d3b"],
  ["#a67c52", "#7d5d3e"],
  ["#5b7fa6", "#33506b"],
  ["#8a6fae", "#5c4a80"],
  ["#c98a53", "#a3653a"],
  ["#4a6a5a", "#2e463c"],
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

// M3 Slice 3: "professional-looking" gradient fallback per the artifact —
// a large faded initial on top of the gradient, derived only from the
// title (deterministic, stable across reloads, no image asset).
export function coverInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return letters || "?";
}

// Free, keyless, standard YouTube thumbnail URL derived from the video id —
// no API call needed. hqdefault exists for effectively every public video;
// callers should fall back to the gradient cover on image load failure.
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
