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

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverGradient(title: string): [string, string] {
  return PALETTE[hashString(title) % PALETTE.length];
}

// redesign/duolingo-flat phase 7 — иллюстрированные обложки (система
// .artcover из утверждённого артефакта, см. src/styles/cover.css и
// src/components/product/cover-art.tsx). Большая буква-инициал поверх
// градиента заменена абстрактным SVG-мотивом. Тему текста мы не знаем и не
// угадываем: мотив выбирается тем же hashString(), что и градиент, — чисто
// декоративное разнообразие, стабильное между перезагрузками.
// Единственное исключение — "video": это реальный признак материала
// (texts.youtube_video_id), а не случайный выбор, поэтому он вне общего
// набора и никогда не выпадает тексту без видео.
export const ABSTRACT_MOTIFS = ["wave", "mountains", "stackedbooks", "dialogue"] as const;
export type CoverMotif = (typeof ABSTRACT_MOTIFS)[number] | "video";

export function coverMotif(title: string, isVideo: boolean): CoverMotif {
  if (isVideo) return "video";
  // Math.floor(h / PALETTE.length), а не h напрямую: иначе h % 6 (палитра)
  // и h % 4 (мотив) делят общий множитель 2, и половина сочетаний
  // "цвет + мотив" никогда бы не встречалась.
  return ABSTRACT_MOTIFS[Math.floor(hashString(title) / PALETTE.length) % ABSTRACT_MOTIFS.length];
}

// Free, keyless, standard YouTube thumbnail URL derived from the video id —
// no API call needed. hqdefault exists for effectively every public video;
// callers should fall back to the illustrated "video" cover on image load failure.
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
