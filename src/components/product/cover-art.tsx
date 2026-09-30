import type { ReactNode } from "react";
import { coverGradient, coverMotif, type CoverMotif } from "@/lib/text-cover";

// redesign/duolingo-flat, phase 7 — иллюстрированная обложка по системе
// .artcover из утверждённого артефакта: градиент (coverGradient) + слой
// абстрактного SVG-мотива (coverMotif) + общий технический слой из
// src/styles/cover.css (grain, блик сверху-слева, тень-корешок справа).
// Всё inline-SVG/CSS, без сетевых картинок.
//
// Растягивается на весь ближайший positioned-родитель (absolute inset-0),
// поэтому родитель должен быть relative + overflow-hidden со своим
// border-radius. children заменяют мотив — так YouTube-превью получает тот
// же технический слой поверх себя. Всё, что родитель рисует ПОСЛЕ
// CoverArt (затемнение, заголовок), ложится выше: isolation у .artcover
// держит внутренние z-index внутри.
//
// Пример:
//   <div className="relative aspect-[3/4] overflow-hidden rounded-[14px]">
//     <CoverArt title={item.title} isVideo={Boolean(item.youtubeVideoId)} />
//     <p className="relative">…</p>
//   </div>

// viewBox 0 0 100 100, preserveAspectRatio slice — те же координаты, что в
// артефакте (там у wave/mountains/stackedbooks был ещё glow-фильтр вокруг
// "солнца"; он требует <defs> с уникальным id на каждой карточке, поэтому
// здесь вместо него просто полупрозрачный круг, как у reader-meta-cover).
function Motif({ motif, ink }: { motif: CoverMotif; ink: string }) {
  switch (motif) {
    case "wave":
      return (
        <>
          <circle cx="78" cy="20" r="10" fill="rgba(255,255,255,.16)" />
          <circle cx="78" cy="20" r="6.5" fill="rgba(255,255,255,.55)" />
          <path d="M-5 66 C15 54 30 78 50 66 C70 54 85 78 105 66 L105 110 L-5 110 Z" fill="rgba(255,255,255,.16)" />
          <path d="M-5 78 C15 66 30 90 50 78 C70 66 85 90 105 78 L105 110 L-5 110 Z" fill="rgba(255,255,255,.3)" />
        </>
      );
    case "mountains":
      return (
        <>
          <circle cx="80" cy="20" r="8" fill="rgba(255,255,255,.4)" />
          <polygon points="-5,98 25,48 50,74 65,54 108,98" fill="rgba(255,255,255,.16)" />
          <polygon points="8,98 38,60 60,82 78,64 108,98" fill="rgba(255,255,255,.3)" />
        </>
      );
    case "stackedbooks":
      return (
        <>
          <circle cx="74" cy="20" r="9" fill="rgba(255,255,255,.4)" />
          <rect x="20" y="78" width="60" height="10" rx="2" fill="rgba(255,255,255,.2)" />
          <rect x="26" y="66" width="48" height="10" rx="2" fill="rgba(255,255,255,.28)" transform="rotate(-2 50 71)" />
          <rect x="30" y="54" width="36" height="10" rx="2" fill="rgba(255,255,255,.45)" transform="rotate(1.5 50 59)" />
        </>
      );
    case "dialogue":
      return (
        <>
          <rect x="12" y="28" width="50" height="34" rx="16" fill="rgba(255,255,255,.16)" />
          <path d="M24 60 L18 73 L35 62 Z" fill="rgba(255,255,255,.16)" />
          <rect x="38" y="48" width="50" height="32" rx="16" fill="rgba(255,255,255,.32)" />
          <path d="M80 76 L88 87 L70 79 Z" fill="rgba(255,255,255,.32)" />
        </>
      );
    case "video":
      return (
        <>
          <circle cx="50" cy="46" r="27" fill="rgba(255,255,255,.18)" />
          <circle cx="50" cy="46" r="19" fill="rgba(255,255,255,.92)" />
          <path d="M45 35 L65 46 L45 53 Z" fill={ink} />
        </>
      );
  }
}

export function CoverArt({
  title,
  isVideo = false,
  angle = 150,
  banner = false,
  children,
}: {
  title: string;
  isVideo?: boolean;
  /** Угол градиента — у text-cover-card исторически 135deg, у остальных 150deg. */
  angle?: number;
  /** Широкая плашка (library-featured-card, ~7:1): мотив — квадрат у правого
   *  края с растворением влево, а не slice на всю ширину (иначе play-иконка
   *  раздувается в 7 раз и обрезается). */
  banner?: boolean;
  /** Заменяет мотив (например, YouTube-превью); технический слой остаётся. */
  children?: ReactNode;
}) {
  const [gradientA, gradientB] = coverGradient(title);
  return (
    <span
      aria-hidden="true"
      className="artcover"
      style={{ background: `linear-gradient(${angle}deg, ${gradientA}, ${gradientB})` }}
    >
      {children ?? (
        <svg className={banner ? "artcover-motif artcover-motif--banner" : "artcover-motif"} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Motif motif={coverMotif(title, isVideo)} ink={gradientB} />
        </svg>
      )}
    </span>
  );
}
