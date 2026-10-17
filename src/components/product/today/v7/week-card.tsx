import { FlameIcon } from "./icons";

import type { DayMark } from "@/lib/week-marks";
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Карточка «Неделя» из макета: Пн–Вс текущей ISO-недели, огонёк в днях с
// занятиями, пунктир — сегодня, если ещё не занимался.
export default function WeekCard({ marks, record }: { marks: DayMark[]; record: number }) {
  const doneCount = marks.filter((m) => m === "done").length;
  return (
    <section className="td-card td-week" aria-label={`Неделя: занятий ${doneCount} из 7`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Неделя</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ember-text)" }}>Рекорд: {record} {daysWord(record)}</div>
      </div>
      <div className="td-week-grid">
        {marks.map((m, i) => {
          const isToday = m === "today";
          return (
            <div key={i}>
              <div
                className="td-day"
                style={
                  m === "done"
                    ? { background: "var(--ember)" }
                    : isToday
                      ? { background: "var(--surface)", border: "2px dashed var(--ember)" }
                      : { background: "var(--surface-muted)" }
                }
              >
                {m === "done" && <FlameIcon size={18} fill="#fff" inner={null} />}
              </div>
              <div className={isToday ? undefined : "td-muted"} style={{ marginTop: 4, ...(isToday ? { color: "var(--ember-text)" } : {}) }}>
                {WEEKDAYS[i]}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function daysWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}
