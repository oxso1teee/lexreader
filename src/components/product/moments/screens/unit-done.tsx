"use client";

import { Button } from "@/components/ui/button";
import type { UnitDoneMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Unit-done.dc.html. Реальные цифры из
// path.stages/progress-engine.ts (stageIndex/stagesTotal/skillsInStage) —
// "новых слов"/"текста" из макета опущены, в учебных путях нет честного
// способа посчитать их именно по этапу (не выдумываем).
export function UnitDoneScreen({ moment, onClose }: { moment: UnitDoneMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title={`${moment.stageTitle} пройден`}
      background="linear-gradient(150deg, var(--sky), var(--sky-edge))"
      foreground="#fff"
      onClose={onClose}
      footerDelay={1.2}
      footer={
        <Button
          className="mo-cta"
          onClick={onClose}
          style={{ ["--btn-fill" as string]: "#fff", ["--btn-edge" as string]: "#e5e5e5", ["--btn-label" as string]: "var(--sky-text)" }}
        >
          Продолжить
        </Button>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 86 }}>
        <svg viewBox="0 0 160 190" width="120" height="142" aria-hidden="true" style={{ margin: "0 auto" }}>
          <path d="M30 14h100v42c0 32-22 56-50 56S30 88 30 56z" fill="var(--sun)" stroke="var(--sun-edge)" strokeWidth="6" strokeLinejoin="round" />
          <rect x="68" y="112" width="24" height="30" fill="var(--ember)" stroke="var(--sun-edge)" strokeWidth="6" />
          <rect x="40" y="142" width="80" height="26" rx="8" fill="var(--sun)" stroke="var(--sun-edge)" strokeWidth="6" />
          <text x="80" y="76" textAnchor="middle" fontFamily="Unbounded, sans-serif" fontWeight="900" fontSize="34" fill="var(--sun-text)">
            {moment.stageIndex}
          </text>
        </svg>
        <p className="mo-rise" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, marginTop: 18 }}>
          Этап {moment.stageIndex} из {moment.stagesTotal} пройден
        </p>
        <h2 className="mo-disp mo-rise" style={{ margin: "8px 24px 0", fontSize: 26, lineHeight: 1.2, fontWeight: 900 }}>
          {moment.pathTitle}
        </h2>
      </div>

      <div className="mo-rise" style={{ margin: "26px 20px 0", borderRadius: 18, background: "rgba(255,255,255,.16)", padding: 14, textAlign: "center" }}>
        <div className="mo-disp" style={{ fontSize: 24, fontWeight: 900 }}>{moment.skillsInStage}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>навыков закреплено</div>
      </div>

      {moment.nextStageTitle && (
        <div className="mo-rise" style={{ margin: "12px 20px 0", borderRadius: 18, background: "#fff", color: "#1a1a1a", padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sky-text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Открыт следующий этап
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{moment.nextStageTitle}</div>
        </div>
      )}
    </MomentScreen>
  );
}
