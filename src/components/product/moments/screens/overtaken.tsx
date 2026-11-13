"use client";

import { Button } from "@/components/ui/button";
import type { OvertakenMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Overtaken.dc.html, reference/Overtaken.png.
// "Рейтинг недели" в макете — три карточки, которые меняются местами
// (друг обгоняет); здесь — статичные, но подписанные те же данные (кто
// сейчас выше кого), анимация перестановки опущена — собственный ранг до
// обгона в моменте не хранится, только факт "теперь он выше тебя".
export function OvertakenScreen({ moment, onClose }: { moment: OvertakenMoment; onClose: () => void }) {
  const gap = useCountUp(moment.xpGapToReclaim, { delay: 2000, duration: 700 });
  const gapPct = Math.min(100, Math.round((moment.xpGapToReclaim / 20) * 100));

  return (
    <MomentScreen
      title={`${moment.friendName} обогнал тебя!`}
      onClose={onClose}
      footerDelay={1.8}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <Button
            className="mo-cta"
            onClick={onClose}
            style={{ ["--btn-fill" as string]: "var(--color-forest)", ["--btn-edge" as string]: "var(--color-forest-text)", ["--btn-label" as string]: "#fff" }}
          >
            Вернуть место · 3 мин
          </Button>
          <button type="button" onClick={onClose} className="focus-ring mo-muted" style={{ fontSize: 14, fontWeight: 600, background: "none", border: "none" }}>
            Позже
          </button>
        </div>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 64 }}>
        <div
          className="mo-slidein"
          style={{
            margin: "0 auto",
            width: 72,
            height: 72,
            borderRadius: 999,
            background: "var(--sky)",
            color: "#fff",
            fontSize: 26,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-hidden="true"
        >
          {moment.friendInitial}
        </div>
        <p className="mo-rise" style={{ margin: "18px 28px 0", fontSize: 16, lineHeight: 1.4, fontWeight: 600, animationDelay: "0.3s" }}>
          До {moment.theirRank} места тебе не хватает {moment.xpGapToReclaim} XP. Это одно короткое занятие.
        </p>
      </div>

      <div
        role="img"
        aria-label={`Рейтинг недели: ${moment.friendName} ${moment.theirRank}, ты ${moment.theirRank + 1}`}
        className="mo-cardin"
        style={{ position: "relative", margin: "28px 20px 0", display: "flex", flexDirection: "column", gap: 10, animationDelay: "0.5s" }}
      >
        <div className="mo-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 900, width: 20, textAlign: "center" }}>{moment.theirRank}</span>
          <span style={{ width: 36, height: 36, borderRadius: 999, background: "var(--sky)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            {moment.friendInitial}
          </span>
          <span style={{ fontWeight: 700, flex: 1 }}>{moment.friendName}</span>
        </div>
        <div
          className="mo-card"
          style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--color-forest-tint)", border: "2px solid var(--color-forest)" }}
        >
          <span style={{ fontWeight: 900, width: 20, textAlign: "center" }}>{moment.theirRank + 1}</span>
          <span style={{ width: 36, height: 36, borderRadius: 999, background: "var(--color-forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            Ты
          </span>
          <span style={{ fontWeight: 700, flex: 1 }}>Ты</span>
        </div>
      </div>

      <div className="mo-rise" style={{ margin: "16px 20px 0", borderRadius: 18, background: "var(--sun-tint)", padding: "12px 16px", animationDelay: "1.9s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--sun-text)" }}>Разрыв с {moment.friendName}</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: "var(--sun-text)" }}>{gap} XP</span>
        </div>
        <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: "rgba(0,0,0,.08)", overflow: "hidden" }}>
          <div className="mo-growbar" style={{ height: "100%", borderRadius: 99, background: "var(--ember)", width: `${gapPct}%` }} />
        </div>
      </div>
    </MomentScreen>
  );
}
