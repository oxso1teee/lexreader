"use client";

import Link from "next/link";
import { track } from "@/lib/posthog-client";
import { buttonClassName } from "@/components/ui/button";

// Зелёная карточка «Занятие на сегодня» из макета. Решение, ЧТО предложить
// (миссия > повтор > чтение > добавить материал), принимает home/page.tsx —
// та же логика, что была; здесь только вид.
export default function TodayHero({
  eyebrow,
  title,
  meta,
  ctaLabel,
  href,
  actionType,
  footnote,
}: {
  eyebrow: string;
  title: string;
  meta: string[];
  ctaLabel: string;
  href: string;
  actionType: string;
  footnote?: string;
}) {
  return (
    <section className="td-hero" aria-label={eyebrow}>
      <div className="td-hero-eyebrow">{eyebrow}</div>
      <h2 className="td-disp td-hero-title" style={{ margin: "8px 0 0" }}>
        {title}
      </h2>
      {meta.length > 0 && (
        <div className="td-hero-meta">
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
      <Link
        href={href}
        className={buttonClassName({ className: "td-hero-cta" })}
        onClick={() => track("today_primary_action_clicked", { action_type: actionType, destination: href })}
      >
        {ctaLabel}
      </Link>
      {footnote && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{footnote}</div>}
    </section>
  );
}
