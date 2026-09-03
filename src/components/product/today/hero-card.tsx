"use client";

import Link from "next/link";
import { track } from "@/lib/posthog-client";

const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Today mockup alignment — заменяет HeroMissionCard и PrimaryActionCard
// одним компонентом: обе карточки уже были визуально почти идентичны
// (тот же forest-градиент, та же CTA-пилюля), а референс требует ОДНУ
// новую разметку (кольцо прогресса, italic Playfair-заголовок, точные
// радиусы/паддинги) — дублировать её в двух файлах было бы избыточно.
// home/page.tsx решает, какую ветку показывать (миссия/повтор/чтение/
// добавить материал) — та же decidePrimaryAction/pickHeroMission логика,
// не тронута, просто приводится к одной форме props здесь.
//
// Заголовок использует --font-home-serif (не общий --font-serif/
// --font-playfair) — тот подключается только внутри landing-page.tsx
// (см. src/app/layout.tsx), вне области видимости на /home. Ветка не
// трогает корневой layout.tsx (за пределами заявленного скоупа "/home и
// mobile-bottom-nav.tsx"), поэтому home/page.tsx грузит Playfair Display
// точно так же локально, как уже делает landing-page.tsx — переменная
// подключена в className на корневом div страницы, см. page.tsx.
//
// progressPercent — процент дневной цели по словам (newWordsToday /
// daily_word_goal), единый для всех веток: это единственная метрика,
// доступная уже сейчас во всех 4 состояниях карточки без новых запросов
// к БД (у continue_reading есть свой percentRead, но у "повторить"/
// "добавить материал" его нет — единый источник данных проще и честнее,
// чем разное значение кольца в разных состояниях).
export default function HeroCard({
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  href,
  actionType,
  progressPercent,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  href: string;
  /** privacy-safe category for analytics — see docs/ui/analytics-events.md */
  actionType: "mission" | "review" | "continue_reading" | "add_material";
  progressPercent: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div
      className="relative overflow-hidden rounded-[22px] p-[18px] text-white"
      style={{ background: "linear-gradient(150deg, var(--color-forest), var(--color-forest-light))" }}
    >
      {/* Кольцо прогресса — верхний правый угол, ~38px, полупрозрачный трек
          + белая дуга, число внутри (Geist Mono, 9px, bold). rotate(-90deg)
          на самом svg, а не только на дуге — трек и дуга должны стартовать
          из одной и той же точки (12 часов). */}
      <div className="absolute top-[18px] right-[18px] h-[38px] w-[38px] -rotate-90">
        <svg viewBox="0 0 38 38" className="h-full w-full" aria-hidden="true">
          <circle cx="19" cy="19" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="3" />
          <circle
            cx="19"
            cy="19"
            r={RING_RADIUS}
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
      </div>
      <span
        className="absolute top-[18px] right-[18px] flex h-[38px] w-[38px] items-center justify-center font-mono text-[9px] font-bold text-white"
        aria-hidden="true"
      >
        {clamped}%
      </span>

      <div className="flex flex-col gap-2 pr-11">
        {eyebrow && <span className="block max-w-[74%] text-[10px] uppercase opacity-[.82]">{eyebrow}</span>}
        <h2 className="max-w-[78%] font-[family-name:var(--font-home-serif)] text-[20px] leading-[1.2] font-bold italic">
          {title}
        </h2>
        {subtitle && <p className="text-[11px] opacity-[.85]">{subtitle}</p>}
      </div>

      <Link
        href={href}
        onClick={() => track("today_primary_action_clicked", { action_type: actionType, destination: href })}
        className="focus-ring mt-4 inline-flex items-center justify-center rounded-full bg-white px-[15px] py-[9px] text-[12px] font-bold text-forest"
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}
