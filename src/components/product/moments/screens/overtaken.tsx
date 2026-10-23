"use client";

import { ButtonLink } from "@/components/ui/button";
import type { OvertakenMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Overtaken.dc.html, reference/Overtaken.png.
// Друг влетает слева, строки рейтинга меняются местами (он поднимается над
// тобой). Очки — реальные из get_weekly_leaderboard (overtaken.ts).
export function OvertakenScreen({ moment, onClose }: { moment: OvertakenMoment; onClose: () => void }) {
  const gap = useCountUp(moment.xpGapToReclaim, { delay: 2000, duration: 700 });
  const hasScores = moment.theirScore != null && moment.myScore != null;
  const closeness = hasScores && moment.theirScore! > 0 ? Math.round((moment.myScore! / moment.theirScore!) * 100) : 0;
  const myRank = moment.theirRank + 1;
  const above = moment.above ?? null;
  // Без строки сверху рейтинг из двух строк — без пустого места.
  const top = above ? 68 : 0;

  return (
    <MomentScreen
      title={`${moment.friendName} обогнал тебя!`}
      onClose={onClose}
      footerDelay={1.8}
      footer={
        <>
          <ButtonLink href="/brain/all/review" className="mo-cta" onClick={onClose}>
            Вернуть место · 3 мин
          </ButtonLink>
          <button type="button" onClick={onClose} className="mo-link2">
            Позже
          </button>
        </>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 70 }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <div className="ov-dash" style={{ position: "relative", display: "inline-flex" }}>
            <span
              className="mo-disp"
              style={{ width: 108, height: 108, borderRadius: 999, background: "#0b79b0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 900, border: "5px solid var(--background)", boxShadow: "0 0 0 4px #0b79b0" }}
              aria-hidden="true"
            >
              {moment.friendInitial}
            </span>
          </div>
          <svg className="ov-sp" viewBox="0 0 60 60" width="60" height="60" aria-hidden="true" style={{ position: "absolute", left: -66, top: 24 }}>
            <path d="M10 14h44M2 30h48M14 46h36" stroke="#0b79b0" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "22px 24px 0", fontSize: 25, lineHeight: 1.2, fontWeight: 900, animationDelay: ".7s" }}>
          {moment.friendName} обогнал тебя!
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 30px 0", fontSize: 16, lineHeight: 1.4, animationDelay: ".8s" }}>
          До {moment.theirRank} места тебе не хватает {moment.xpGapToReclaim} XP. Это одно короткое занятие
        </p>
      </div>

      <div
        className="mo-rise"
        style={{ position: "relative", margin: "26px 20px 0", height: top + 132, animationDelay: ".9s" }}
        role="img"
        aria-label={`Рейтинг недели: ${above ? `${above.initial} ${moment.theirRank - 1}, ` : ""}${moment.friendName} ${moment.theirRank}, ты ${myRank}`}
      >
        {above && (
          <div className="ov-row" style={{ top: 0 }}>
            <span className="mo-muted" style={{ width: 18, fontWeight: 700 }}>{moment.theirRank - 1}</span>
            <span className="ov-sm" style={{ background: "var(--ember-text)" }}>{above.initial}</span>
            <span style={{ flex: 1 }}>{above.initial}</span>
            <span className="mo-muted" style={{ fontWeight: 700 }}>{above.score} XP</span>
          </div>
        )}
        <div className="ov-row ov-mdown" style={{ top, background: "var(--leaf-tint)", borderColor: "var(--leaf)" }}>
          <span style={{ width: 18, fontWeight: 700, color: "var(--leaf-text)" }}>{myRank}</span>
          <span className="ov-sm" style={{ background: "var(--leaf)" }}>Ты</span>
          <b style={{ flex: 1 }}>Ты</b>
          {moment.myScore != null && <span style={{ fontWeight: 700, color: "var(--leaf-text)" }}>{moment.myScore} XP</span>}
        </div>
        <div className="ov-row ov-mup" style={{ top: top + 68, borderColor: "#0b79b0" }}>
          <span style={{ width: 18, fontWeight: 700, color: "var(--sky-text)" }}>{moment.theirRank}</span>
          <span className="ov-sm" style={{ background: "#0b79b0" }}>{moment.friendInitial}</span>
          <b style={{ flex: 1 }}>{moment.friendName}</b>
          <svg className="ov-arr" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--sky-text)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          {moment.theirScore != null && <span style={{ fontWeight: 700, color: "var(--sky-text)" }}>{moment.theirScore} XP</span>}
        </div>
      </div>

      <div className="mo-rise" style={{ margin: "6px 20px 0", padding: "12px 14px", borderRadius: 16, background: "var(--sun-tint)", display: "flex", alignItems: "center", gap: 12, animationDelay: "1.9s" }}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--sun)" stroke="var(--sun-edge)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "var(--sun-text)" }}>
            <span>Разрыв с {moment.friendName}</span>
            <span>{gap} XP</span>
          </div>
          {hasScores && (
            <div style={{ height: 10, borderRadius: 99, background: "rgba(122,89,0,.15)", marginTop: 6, overflow: "hidden" }}>
              <div className="mo-growbar" style={{ height: "100%", width: `${closeness}%`, borderRadius: 99, background: "var(--ember-text)" }} />
            </div>
          )}
        </div>
      </div>
    </MomentScreen>
  );
}
