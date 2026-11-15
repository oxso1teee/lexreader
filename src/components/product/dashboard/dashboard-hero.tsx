"use client";

import Link from "next/link";
import { Lex } from "@/components/product/mascot/lex";
import { buttonClassName } from "@/components/ui/button";
import { track } from "@/lib/posthog-client";

export interface DashboardHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta: string[];
  ctaLabel: string;
  href: string;
  /** mission | review | continue_reading | add_material — только для аналитики. */
  actionType: string;
  footnote?: string;
}

// Зелёная карточка «Занятие на сегодня». Что именно предложить (миссия >
// повтор > чтение > добавить материал), решает home/page.tsx — здесь только
// вид и событие аналитики (в нём лишь тип действия и маршрут, без названий).
export default function DashboardHero(props: DashboardHeroProps) {
  return (
    <section className="dash-hero" aria-labelledby="dash-hero-title">
      <div className="dash-hero-body">
        <p className="dash-hero-eyebrow">{props.eyebrow}</p>
        <h2 id="dash-hero-title" className="dash-hero-title">
          {props.title}
        </h2>
        {props.subtitle && <p className="dash-hero-sub">{props.subtitle}</p>}
        {props.meta.length > 0 && (
          <ul className="dash-hero-meta">
            {props.meta.map((item, i) => (
              <li key={`${i}-${item}`}>{item}</li>
            ))}
          </ul>
        )}
        <Link
          href={props.href}
          className={buttonClassName({ className: "dash-hero-cta" })}
          onClick={() =>
            track("today_primary_action_clicked", { action_type: props.actionType, destination: props.href })
          }
        >
          {props.ctaLabel}
        </Link>
        {props.footnote && <p className="dash-hero-foot">{props.footnote}</p>}
      </div>
      {/* Прячем обёртку, а не сам SVG: у .lex свой display, и он перебил бы слой компонентов. */}
      <div className="dash-hero-lex" aria-hidden="true">
        <Lex mood="joy" tone="pale" size={120} bob />
      </div>
    </section>
  );
}
