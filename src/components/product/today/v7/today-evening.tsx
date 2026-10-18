"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import type { WeekdayMark } from "@/lib/moments/types";
import { WEEKDAYS_RU } from "@/components/product/moments/moment-screen";
import { FlameIcon, BoltIcon } from "./icons";

// docs/moments/mockups/Today-evening.dc.html, reference/Today-evening.png —
// этап 2 (docs/moments/ROADMAP.md). Карточка-превью push-уведомления из
// макета убрана — это чисто иллюстративный мокап системного пуша внутри
// экрана приложения, не настоящее уведомление (которое всё равно приходит
// через ОС, не рисуется здесь).
function daysWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}

function useCountdownToMidnight(): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const ms = midnight.getTime() - now.getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(`${h} ч ${m} мин`);
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return label;
}

export default function TodayEveningView({
  langCode,
  level,
  streak,
  streakLongest,
  xp,
  week,
  freezeAvailable,
  reviewHref,
  reviewMinutesHint,
}: {
  langCode: string;
  level: string | null;
  streak: number;
  streakLongest: number;
  xp: number;
  week: WeekdayMark[];
  freezeAvailable: boolean;
  reviewHref: string;
  reviewMinutesHint: number | null;
}) {
  const countdown = useCountdownToMidnight();

  return (
    <div className="td-root">
      <div className="td-topbar">
        <Link href="/settings" className="td-chip td-lang" aria-label={`Язык: ${langCode}${level ? `, уровень ${level}` : ""}`}>
          <span className="td-lang-code">{langCode}</span>
          {level ?? "Язык"}
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <span
            aria-label={`Стрик ${streak} дней, сегодня ещё не продлён`}
            className="td-chip"
            style={{ background: "#fff", border: "2px dashed var(--ember)", color: "var(--ember-text)", animation: "mo-stepring 1.6s ease-out infinite" }}
          >
            <FlameIcon size={20} />
            {streak}
          </span>
          <span className="td-chip td-xp">
            <BoltIcon size={18} />
            {xp.toLocaleString("ru-RU")}
          </span>
        </div>
      </div>

      <div
        className="mo-rise"
        style={{ position: "relative", margin: "14px 16px 0", borderRadius: 24, background: "var(--ember-text)", color: "#fff", padding: "22px 20px 20px", boxShadow: "inset 0 -6px 0 0 #9a330a", overflow: "hidden" }}
      >
        <div className="mo-flick" style={{ position: "absolute", right: 14, top: 10, opacity: 0.95 }}>
          <svg viewBox="0 0 24 24" width="96" height="96" aria-hidden="true">
            <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
            <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
          </svg>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.9 }}>Стрик под угрозой</div>
        <div className="td-disp" style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 900, marginTop: 8, maxWidth: 220 }}>
          {streak} {daysWord(streak)} сгорят в полночь
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 15, fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {countdown ? `Осталось ${countdown}` : "Считаем время…"}
        </div>
        <div style={{ fontSize: 14, marginTop: 4, opacity: 0.92 }}>Одно короткое занятие сохранит серию</div>
        <ButtonLink
          href={reviewHref}
          style={{ marginTop: 16, width: "100%", ["--btn-fill" as string]: "#fff", ["--btn-edge" as string]: "#ffd9a3", ["--btn-label" as string]: "var(--ember-text)" }}
        >
          Спасти стрик{reviewMinutesHint ? ` · ${reviewMinutesHint} мин` : ""}
        </ButtonLink>
      </div>

      <div className="td-card" style={{ margin: "12px 16px 0", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Неделя</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ember-text)" }}>Рекорд: {streakLongest} {daysWord(streakLongest)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginTop: 10, textAlign: "center", fontSize: 12, fontWeight: 600 }}>
          {week.map((mark, i) => {
            const isToday = mark === "today";
            const isDone = mark === "done" || mark === "freeze";
            return (
              <div key={i}>
                <div
                  style={{
                    height: 34,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDone ? "var(--ember)" : isToday ? "#fff" : "var(--surface-muted)",
                    border: isToday ? "2px dashed var(--ember)" : undefined,
                    color: isToday ? "var(--ember-text)" : undefined,
                    fontWeight: isToday ? 700 : undefined,
                    animation: isToday ? "mo-stepring 1.6s ease-out infinite" : undefined,
                  }}
                >
                  {isDone ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="#fff" />
                    </svg>
                  ) : isToday ? (
                    "?"
                  ) : null}
                </div>
                <div className={isToday ? undefined : "td-muted"} style={{ marginTop: 4, color: isToday ? "var(--ember-text)" : undefined }}>
                  {WEEKDAYS_RU[i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="td-card" style={{ margin: "12px 16px 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--sky-tint)", color: "var(--sky-text)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{freezeAvailable ? "Заморозка: 1 на этой неделе" : "Заморозка уже использована"}</div>
          <div className="td-muted" style={{ fontSize: 13, marginTop: 2 }}>
            {freezeAvailable ? "Сработает сама, если пропустишь день" : "Новая придёт в понедельник"}
          </div>
        </div>
      </div>
    </div>
  );
}
