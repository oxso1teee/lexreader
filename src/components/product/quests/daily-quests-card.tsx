"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { questTitle, type DailyQuestItem, type DailyQuestType } from "@/lib/daily-quests-model";
import { QUEST_ICON } from "./quest-icons";

// docs/moments/mockups/Daily-quests.dc.html, reference/Daily-quests.png.
// Карточка на главной: задания дня с прогрессом. Когда все выполнены и сундук
// ещё не забран — верхний баннер + "Открыть сундук" (ссылка на /quests/chest,
// где реально начисляется награда). Полный список и прошлые дни — /quests.
const QUEST_ICON_BG: Readonly<Record<DailyQuestType, string>> = {
  read_minutes: "var(--leaf-tint)",
  review_words: "var(--sky-tint)",
  combo_streak: "var(--ember-tint)",
  earn_xp: "var(--sun-tint)",
  complete_lessons: "var(--leaf-tint)",
  answer_exercises: "var(--sky-tint)",
};
const QUEST_ICON_FG: Readonly<Record<DailyQuestType, string>> = {
  read_minutes: "var(--leaf-text)",
  review_words: "var(--sky-text)",
  combo_streak: "var(--sun-text)",
  earn_xp: "var(--sun-text)",
  complete_lessons: "var(--leaf-text)",
  answer_exercises: "var(--sky-text)",
};

// Иконки заданий — как в макете (вместо эмодзи: эмодзи рисуются по-разному
// на каждой платформе и не красятся токенами).
function QuestIcon({ type }: { type: DailyQuestType }) {
  if (type === "combo_streak")
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
      </svg>
    );
  if (type === "read_minutes")
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z" />
      </svg>
    );
  if (type !== "review_words") return <span aria-hidden="true">{QUEST_ICON[type]}</span>;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="14" height="14" rx="2" />
      <path d="M7 2h12a2 2 0 0 1 2 2v12" />
    </svg>
  );
}

export function DailyQuestsCard({
  items,
  allComplete,
  chestClaimedToday,
}: {
  items: DailyQuestItem[];
  allComplete: boolean;
  chestClaimedToday: boolean;
}) {
  if (allComplete && chestClaimedToday) return null;

  return (
    <div className="mo-card" style={{ padding: 4 }}>
      {allComplete && (
        <div style={{ textAlign: "center", padding: "20px 20px 8px" }}>
          <div className="mo-questbounce" style={{ display: "inline-block" }}>
            <svg viewBox="0 0 120 100" width="120" height="100" aria-hidden="true">
              <rect x="10" y="40" width="100" height="54" rx="10" fill="#c2410c" stroke="#7c2d0a" strokeWidth="5" />
              <path d="M10 46 Q60 6 110 46 V52 H10z" fill="#ff9500" stroke="#7c2d0a" strokeWidth="5" strokeLinejoin="round" />
              <rect x="50" y="44" width="20" height="24" rx="5" fill="#ffc700" stroke="#7c2d0a" strokeWidth="4" />
            </svg>
          </div>
          <p className="mo-disp" style={{ margin: "10px 0 0", fontSize: 24, lineHeight: 1.2, fontWeight: 900 }}>Задания дня выполнены!</p>
          <p className="mo-muted" style={{ margin: "8px 0 0", fontSize: 15 }}>Сундук твой. Новые задания завтра</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((d, i) => {
          const { current, done } = d;
          return (
            <div
              key={d.questType}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderBottom: i < items.length - 1 ? "2px solid var(--border)" : undefined,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  background: QUEST_ICON_BG[d.questType],
                  color: QUEST_ICON_FG[d.questType],
                  fontWeight: 900,
                }}
              >
                <QuestIcon type={d.questType} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
                  <span>{questTitle(d.questType, d.target)}</span>
                  <span style={{ color: "var(--sun-text)", fontVariantNumeric: "tabular-nums" }}>
                    {current}/{d.target}
                  </span>
                </div>
                <div style={{ height: 12, borderRadius: 99, background: "var(--surface-muted)", overflow: "hidden", marginTop: 8 }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 99,
                      background: "var(--sun)",
                      boxShadow: "inset 0 -3px 0 0 var(--sun-edge)",
                      width: `${Math.round((current / d.target) * 100)}%`,
                      transition: "width 0.3s ease-out",
                    }}
                  />
                </div>
              </div>
              {done && (
                <span
                  className="mo-questcheck"
                  style={{ width: 28, height: 28, borderRadius: 999, background: "var(--leaf)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
                >
                  <Check aria-hidden="true" style={{ width: 16, height: 16, color: "#fff" }} strokeWidth={3} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {allComplete && (
        <div style={{ padding: 12 }}>
          <Link
            href="/quests/chest"
            className="btn btn-sun btn-md"
            style={{ display: "flex", width: "100%" }}
          >
            Открыть сундук
          </Link>
        </div>
      )}
    </div>
  );
}
