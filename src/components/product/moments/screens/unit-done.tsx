"use client";

import { Button } from "@/components/ui/button";
import type { UnitDoneMoment } from "@/lib/moments/types";
import { Confetti } from "../confetti";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Unit-done.dc.html, reference/Unit-done.png:
// синий экран, кубок с номером раздела и бликом, «Раздел N пройден»,
// плитки статистики, белая карточка «Открыт раздел» с открывающимся замком.
// Плитки — настоящие данные этапа пути (src/lib/learning-paths): навыков
// закреплено и место этапа в пути, без выдуманных слов/текстов.
export function UnitDoneScreen({ moment, onClose }: { moment: UnitDoneMoment; onClose: () => void }) {
  const skills = useCountUp(moment.skillsInStage, { delay: 1150, duration: 900 });
  const left = Math.max(0, moment.stagesTotal - moment.stageIndex);

  return (
    <MomentScreen
      title={`${moment.stageTitle} пройден`}
      background="#0b79b0"
      foreground="#fff"
      onClose={onClose}
      footerDelay={1.8}
      footer={
        <Button
          className="mo-cta"
          style={{ ["--btn-fill" as string]: "#fff", ["--btn-edge" as string]: "#bfe6f8", ["--btn-label" as string]: "#075a85" }}
          onClick={onClose}
        >
          {moment.nextStageTitle ? "К следующему разделу" : "Продолжить"}
        </Button>
      }
    >
      <div aria-hidden="true" style={{ position: "absolute", width: 480, height: 480, borderRadius: 999, background: "#075a85", opacity: 0.45, left: -45, top: 40 }} />
      <div style={{ position: "relative", textAlign: "center", paddingTop: 86 }}>
        <Confetti
          seed={17}
          count={30}
          delay={0.5}
          colors={["var(--sun)", "#fff", "var(--leaf-tint-strong)", "var(--ember)", "var(--sky-tint)"]}
          reach={[130, 110]}
          style={{ left: "50%", top: 190 }}
        />
        <div className="ud-up" style={{ display: "inline-block", position: "relative", width: 160, height: 190, overflow: "hidden" }}>
          <svg viewBox="0 0 160 190" width="160" height="190" aria-hidden="true">
            <path d="M30 14h100v42c0 32-22 56-50 56S30 88 30 56z" fill="#ffc700" stroke="#7a5900" strokeWidth="6" strokeLinejoin="round" />
            <path d="M30 26H10v16c0 18 12 30 24 30M130 26h20v16c0 18-12 30-24 30" fill="none" stroke="#7a5900" strokeWidth="6" strokeLinecap="round" />
            <rect x="68" y="112" width="24" height="30" fill="#e0a500" stroke="#7a5900" strokeWidth="6" />
            <rect x="40" y="142" width="80" height="26" rx="8" fill="#ffc700" stroke="#7a5900" strokeWidth="6" />
            <text x="80" y="76" textAnchor="middle" fontFamily="var(--font-unbounded), sans-serif" fontWeight="900" fontSize="34" fill="#7a5900">
              {moment.stageIndex}
            </text>
          </svg>
          <span className="ud-shine" aria-hidden="true" />
        </div>
        <div className="mo-rise" style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.85, marginTop: 18, animationDelay: ".7s" }}>
          Раздел {moment.stageIndex} из {moment.stagesTotal} пройден
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "8px 24px 0", fontSize: 30, lineHeight: 1.15, fontWeight: 900, animationDelay: ".8s" }}>
          {moment.stageTitle.replace(/^Раздел \d+\s*·\s*/, "")}
        </h2>
        <p className="mo-rise" style={{ margin: "10px 30px 0", fontSize: 16, opacity: 0.92, animationDelay: ".9s" }}>
          {moment.pathTitle}
        </p>
      </div>

      <div className="mo-rise" style={{ position: "relative", display: "flex", gap: 10, margin: "26px 20px 0", animationDelay: "1.1s" }}>
        <div style={{ flex: 1, borderRadius: 18, background: "rgba(255,255,255,.16)", padding: 14, textAlign: "center" }}>
          <div className="mo-disp" style={{ fontSize: 24, fontWeight: 900 }}>{skills}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>навыков закреплено</div>
        </div>
        <div style={{ flex: 1, borderRadius: 18, background: "rgba(255,255,255,.16)", padding: 14, textAlign: "center" }}>
          <div className="mo-disp" style={{ fontSize: 24, fontWeight: 900 }}>{left}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{left === 1 ? "раздел впереди" : "разделов впереди"}</div>
        </div>
      </div>

      {moment.nextStageTitle && (
        <div className="mo-rise" style={{ position: "relative", margin: "12px 20px 0", borderRadius: 18, background: "#fff", color: "#1a1a1a", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, animationDelay: "1.3s" }}>
          <div className="ud-unlock" style={{ width: 44, height: 44, borderRadius: 14, background: "var(--leaf-tint)", color: "var(--leaf-text)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" style={{ fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" }}>
              <rect x="7" y="15" width="18" height="13" rx="3" />
              <path className="ud-shackle" d="M11 15v-4a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: ".05em" }}>Открыт раздел {moment.stageIndex + 1}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{moment.nextStageTitle}</div>
          </div>
        </div>
      )}
    </MomentScreen>
  );
}
