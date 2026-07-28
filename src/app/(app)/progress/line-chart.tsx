"use client";

import { useState } from "react";

export default function LineChart({
  title,
  points,
  color = "#a67c52",
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
  const step = points.length > 1 ? w / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : w / 2;
    const y = h - (p.value / max) * (h - 10) - 5;
    return { x, y };
  });
  const path = coords.map((c) => `${c.x},${c.y}`).join(" ");

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

  const active = activeIndex !== null ? { point: points[activeIndex], coord: coords[activeIndex] } : null;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-2 text-sm text-black/50 dark:text-white/50">
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
        <polyline
          points={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={total === 0 ? "4 4" : undefined}
          opacity={total === 0 ? 0.4 : 1}
        />
        {active && (
          <>
            <line
              x1={active.coord.x}
              y1={0}
              x2={active.coord.x}
              y2={h}
              stroke={color}
              strokeWidth="1"
              opacity={0.3}
            />
            <circle cx={active.coord.x} cy={active.coord.y} r={3.5} fill={color} />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-black/40 dark:text-white/40">
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
