"use client";

import { Button } from "@/components/ui/button";
import type { PerfectMoment } from "@/lib/moments/types";
import { Confetti } from "../confetti";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Perfect.dc.html, reference/Perfect.png.
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);
const STARS = [
  { size: 24, left: 50, top: 56, delay: 0 },
  { size: 16, right: 56, top: 84, delay: 0.6 },
  { size: 20, right: 76, bottom: 54, delay: 1.1 },
  { size: 14, left: 80, bottom: 70, delay: 1.5 },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PerfectScreen({ moment, onClose }: { moment: PerfectMoment; onClose: () => void }) {
  const n = useCountUp(moment.cardCount, { delay: 250, duration: 700 });
  const xp = useCountUp(moment.bonusXp, { delay: 1300, duration: 600 });

  return (
    <MomentScreen
      title="Без единой ошибки"
      background="var(--sun)"
      foreground="#1a1a1a"
      onClose={onClose}
      footerDelay={1.8}
      footer={
        <Button
          className="mo-cta"
          onClick={onClose}
          style={{ ["--btn-fill" as string]: "#1a1a1a", ["--btn-edge" as string]: "#000", ["--btn-label" as string]: "#fff" }}
        >
          Забрать бонус
        </Button>
      }
    >
      <div style={{ position: "relative", height: 380, marginTop: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="mo-raysin" style={{ position: "absolute" }}>
          <svg className="mo-spin" viewBox="0 0 300 300" width="340" height="340" aria-hidden="true">
            <g fill="var(--sun-tint)">
              {RAYS.map((deg) => (
                <path key={deg} d="M150 150 L138 0 L162 0 Z" transform={`rotate(${deg} 150 150)`} />
              ))}
            </g>
          </svg>
        </div>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 200,
            height: 200,
            margin: "-100px 0 0 -100px",
            borderRadius: 999,
            border: "6px solid #fff",
          }}
          className="mo-wave-sm"
        />
        <Confetti seed={3} count={30} delay={0.6} reach={[130, 110]} fall={40} style={{ left: "50%", top: "50%" }} />
        {STARS.map((s, i) => (
          <svg
            key={i}
            className="mo-tw"
            viewBox="0 0 24 24"
            width={s.size}
            height={s.size}
            aria-hidden="true"
            style={{ left: s.left, top: s.top, right: s.right, bottom: s.bottom, animationDelay: `${s.delay}s` }}
          >
            <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#fff" />
          </svg>
        ))}
        <div className="mo-stamp" style={{ position: "relative" }}>
          <svg viewBox="0 0 200 200" width="210" height="210" role="img" aria-label={`Значок: ${moment.cardCount} из ${moment.cardCount} без ошибок`}>
            <path d="M100 8l26 54 59 8-43 41 10 59-52-28-52 28 10-59L15 70l59-8z" fill="#fff" stroke="var(--sun-edge)" strokeWidth="8" strokeLinejoin="round" />
            <path d="M100 40l16 34 37 5-27 26 6 37-32-18-32 18 6-37-27-26 37-5z" fill="var(--sun)" />
            <text x="100" y="128" textAnchor="middle" fontFamily="var(--font-unbounded), sans-serif" fontWeight="900" fontSize="40" fill="var(--sun-text)">
              {n}
            </text>
          </svg>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 28px" }}>
        <h2 className="mo-disp mo-rise" style={{ margin: 0, fontSize: 30, lineHeight: 1.15, fontWeight: 900, animationDelay: "0.8s" }}>
          Без единой ошибки!
        </h2>
        <p className="mo-rise" style={{ margin: "10px 0 0", fontSize: 17, fontWeight: 600, animationDelay: "0.95s" }}>
          {moment.cardCount} заданий из {moment.cardCount} верно с первого раза
        </p>
      </div>

      <div className="mo-rise" style={{ margin: "26px 20px 0", animationDelay: "1.15s" }}>
        <div
          className="mo-bonus"
          style={{
            borderRadius: 20,
            background: "#fff",
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "inset 0 -5px 0 0 var(--sun-edge)",
          }}
        >
          <svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true">
            <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--sun)" stroke="var(--sun-edge)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <div style={{ flex: 1 }}>
            <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, color: "var(--sun-text)" }}>
              +{xp} XP
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>бонус за чистое занятие</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, background: "rgba(255,255,255,.55)", textAlign: "center" }}>
            <div className="mo-disp" style={{ fontSize: 20, fontWeight: 900 }}>
              100%
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>точность</div>
          </div>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, background: "rgba(255,255,255,.55)", textAlign: "center" }}>
            <div className="mo-disp" style={{ fontSize: 20, fontWeight: 900 }}>
              {formatDuration(moment.durationSec)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>время</div>
          </div>
          <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, background: "rgba(255,255,255,.55)", textAlign: "center" }}>
            <div className="mo-disp" style={{ fontSize: 20, fontWeight: 900 }}>
              {moment.cardCount}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>подряд</div>
          </div>
        </div>
      </div>
    </MomentScreen>
  );
}
