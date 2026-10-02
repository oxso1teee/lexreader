"use client";

import { useState } from "react";
import { cardClassName } from "@/components/ui/card";

export default function LineChart({
  title,
  points,
  // docs/release-2026-08-26/12_VIZUALNAYA_IDENTICHNOST_RESHENIE_2026-08-26.md
  // — единственный акцент. #a67c52 — буквально старый caramel-хекс,
  // пропущенный миграцией caramel→forest (PR #49): та миграция ловила
  // Tailwind-классы (bg-caramel и т.п.), не сырые hex-литералы внутри
  // default-параметров TSX. page.tsx больше не передаёт цвет явно ни для
  // одного из двух графиков — оба используют этот дефолт.
  color = "var(--color-forest)",
}: {
  title: string;
  points: { label: string; value: number }[];
  color?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = points.reduce((s, p) => s + p.value, 0);
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 300;
  const h = 80;
  // redesign/duolingo-flat phase 10 — плоский bar chart вместо полилинии:
  // по столбику на точку, сплошная заливка color, скруглены только верхние
  // углы. Каждой точке — равный слот шириной w/n, coords[i].x — центр
  // слота, поэтому pickNearestIndex ниже работает без изменений (ближайший
  // центр = столбик под курсором). SVG без явной высоты (w-full, высота из
  // viewBox 300×80) масштабируется равномерно, так что радиус не
  // растягивается в эллипс. Нулевые дни — тонкая полупрозрачная "полочка"
  // у основания, чтобы пустой период не выглядел как сломанный график.
  const slot = points.length > 0 ? w / points.length : w;
  const barW = slot * 0.7;
  const coords = points.map((p, i) => {
    const x = i * slot + slot / 2;
    const y = h - Math.max(1.5, (p.value / max) * (h - 4));
    return { x, y };
  });

  function barPath(cx: number, top: number) {
    const x = cx - barW / 2;
    const r = Math.min(2.5, barW / 2, h - top);
    return `M${x},${h} V${top + r} A${r},${r} 0 0 1 ${x + r},${top} H${x + barW - r} A${r},${r} 0 0 1 ${x + barW},${top + r} V${h} Z`;
  }

  // Из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, "Дополнительно
  // найдено"): точное значение за день по наведению/тапу на график, а не
  // просто статичная полилиния.
  function pickNearestIndex(clientX: number, svg: SVGSVGElement) {
    if (coords.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - relativeX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    return nearest;
  }

  const active = activeIndex !== null ? { point: points[activeIndex] } : null;

  return (
    <div className={cardClassName()}>
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-2 text-sm text-[var(--text-secondary)]">
        {active ? `${active.point.label}: ${active.point.value}` : `${total} за период`}
      </p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full touch-none"
        preserveAspectRatio="none"
        onMouseMove={(e) => setActiveIndex(pickNearestIndex(e.clientX, e.currentTarget))}
        onMouseLeave={() => setActiveIndex(null)}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (touch) setActiveIndex(pickNearestIndex(touch.clientX, e.currentTarget));
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (touch) setActiveIndex(pickNearestIndex(touch.clientX, e.currentTarget));
        }}
        onTouchEnd={() => setActiveIndex(null)}
      >
        {coords.map((c, i) => {
          const isActive = activeIndex === i;
          const isZero = points[i].value === 0;
          return (
            <path
              key={points[i].label + i}
              d={barPath(c.x, c.y)}
              fill={color}
              opacity={isZero ? 0.25 : 1}
              // Активный день: тот же цвет + обводка цветом текста — видна и
              // на светлой, и на тёмной карточке (затемнение заливки на
              // тёмном фоне читалось бы как "погасший" столбик).
              stroke={isActive ? "var(--foreground)" : undefined}
              strokeWidth={isActive ? 1 : undefined}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-[var(--text-secondary)]">
        {points.length > 0 && (
          <>
            <span>{points[0].label}</span>
            <span>{points[points.length - 1].label}</span>
          </>
        )}
      </div>
    </div>
  );
}
