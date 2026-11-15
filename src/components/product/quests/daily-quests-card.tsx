"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { DailyQuestDef, DailyQuestProgress } from "@/lib/daily-quests";

// docs/moments/mockups/Daily-quests.dc.html, reference/Daily-quests.png.
// Карточка на главной: 3 задания дня с прогрессом. Когда все три
// выполнены и сундук ещё не забран — верхний баннер + "Открыть сундук"
// (ссылка на /quests/chest, где реально начисляется награда).
const QUEST_LABEL: Record<DailyQuestDef["questType"], (target: number) => string> = {
  read_minutes: (n) => `Прочитать ${n} минут`,
  review_words: (n) => `Повторить ${n} слов`,
  combo_streak: (n) => `${n} верных подряд`,
};

const QUEST_ICON_BG: Record<DailyQuestDef["questType"], string> = {
  read_minutes: "var(--leaf-tint)",
  review_words: "var(--sky-tint)",
  combo_streak: "var(--sun-tint)",
};
const QUEST_ICON_FG: Record<DailyQuestDef["questType"], string> = {
  read_minutes: "var(--leaf-text)",
  review_words: "var(--sky-text)",
  combo_streak: "var(--sun-text)",
};

export function DailyQuestsCard({
  defs,
  progress,
  allComplete,
  chestClaimedToday,
}: {
  defs: DailyQuestDef[];
  progress: DailyQuestProgress;
  allComplete: boolean;
  chestClaimedToday: boolean;
}) {
  if (allComplete && chestClaimedToday) return null;

  return (
    <div className="mo-card" style={{ padding: 4 }}>
      {allComplete && (
        <div style={{ textAlign: "center", padding: "16px 20px 4px" }}>
          <div className="mo-questbounce" style={{ display: "inline-block" }}>
            <svg viewBox="0 0 120 100" width="64" height="54" aria-hidden="true">
              <rect x="10" y="40" width="100" height="54" rx="10" fill="#c2410c" stroke="#7c2d0a" strokeWidth="5" />
              <path d="M10 46 Q60 6 110 46 V52 H10z" fill="#ff9500" stroke="#7c2d0a" strokeWidth="5" strokeLinejoin="round" />
              <rect x="50" y="44" width="20" height="24" rx="5" fill="#ffc700" stroke="#7c2d0a" strokeWidth="4" />
            </svg>
          </div>
          <p className="mo-disp" style={{ margin: "6px 0 0", fontSize: 17, fontWeight: 900 }}>Задания дня выполнены!</p>
          <p className="mo-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>Сундук твой</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {defs.map((d, i) => {
          const current = Math.min(progress[d.questType], d.target);
          const done = current >= d.target;
          return (
            <div
              key={d.questType}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderBottom: i < defs.length - 1 ? "2px solid var(--border)" : undefined,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
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
                {d.questType === "combo_streak" ? "🔥" : d.questType === "read_minutes" ? "📖" : "🗂"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                  <span>{QUEST_LABEL[d.questType](d.target)}</span>
                  <span style={{ color: "var(--sun-text)", fontVariantNumeric: "tabular-nums" }}>
                    {current}/{d.target}
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 99, background: "var(--border)", overflow: "hidden", marginTop: 6 }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 99,
                      background: "var(--sun)",
                      width: `${Math.round((current / d.target) * 100)}%`,
                      transition: "width 0.3s ease-out",
                    }}
                  />
                </div>
              </div>
              {done && (
                <span
                  className="mo-questcheck"
                  style={{ width: 26, height: 26, borderRadius: 999, background: "var(--leaf)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
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
