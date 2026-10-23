"use client";

import { useEffect, useState } from "react";
import type { WeekRecapMoment } from "@/lib/moments/types";
import { useCountUp } from "../use-count-up";
import { haptic } from "@/lib/native";

// Эталон: docs/moments/mockups/Week-recap.dc.html. Истории, 4 слайда,
// автопереключение 5с, тап слева/справа — назад/вперёд. Не через
// MomentScreen (другая палитра фона на каждый слайд, свой крестик-закрытие
// в правом верхнем углу вместо нижней кнопки) — собственная полноэкранная
// обёртка с тем же .mo-screen reduced-motion-поведением.
// Цвета историй как в макете; синий и оранжевый — тёмные оттенки, чтобы
// белый текст читался (4.5:1).
const SLIDE_BG = ["var(--leaf)", "#0b79b0", "#c2410c", "#ffc700"];
const SLIDE_FG = ["#fff", "#fff", "#fff", "#1a1a1a"];
const SLIDE_SECONDS = 5;

export function WeekRecapScreen({ moment, onClose }: { moment: WeekRecapMoment; onClose: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    void haptic("light");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setI((v) => Math.min(3, v + 1)), SLIDE_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [i]);

  const [shared, setShared] = useState(false);
  async function share() {
    const text = `Моя неделя в LexReader: ${moment.newWordsCount} новых слов, ${moment.minutesRead} мин чтения, ${moment.activeDays}/7 дней без пропуска.`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {
      // Отмена шаринга пользователем — не ошибка.
    }
  }
  const newWords = useCountUp(moment.newWordsCount, { delay: 100, duration: 900 });

  return (
    <div className="mo-screen" style={{ "--mo-bg": SLIDE_BG[i], "--mo-fg": SLIDE_FG[i] } as React.CSSProperties}>
      <div className="mo-column">
      <div className="relative z-[3] px-3.5 pt-12">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: i === 3 ? "rgba(26,26,26,.2)" : "rgba(255,255,255,.35)" }}>
              <div
                key={k === i ? `run-${i}` : `idle-${k}`}
                className={k === i ? "wk-run h-full rounded-full" : "h-full rounded-full"}
                style={{
                  background: i === 3 ? "#1a1a1a" : "#fff",
                  width: k < i ? "100%" : k === i ? undefined : "0%",
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 999, background: "var(--leaf)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", flex: "none" }}>
            <svg viewBox="0 0 128 150" width="18" height="21"><path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="#fff" /></svg>
          </span>
          <span className="flex-1 text-sm font-bold">
            Итоги недели <span className="opacity-75">· {moment.weekLabel}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-11 w-11 items-center justify-center" style={{ color: SLIDE_FG[i] }}>
            <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <button type="button" aria-label="Назад" onClick={() => setI((v) => Math.max(0, v - 1))} className="absolute bottom-0 left-0 top-[90px] z-[2] w-[35%] border-0 bg-transparent" />
      <button type="button" aria-label="Дальше" onClick={() => setI((v) => Math.min(3, v + 1))} className="absolute bottom-0 right-0 top-[90px] z-[2] w-[65%] border-0 bg-transparent" />

      {i === 0 && (
        <div className="absolute left-0 right-0 top-[210px] px-7 text-center">
          <div className="wk-big mx-auto w-fit"><div className="na-bob">
            <svg viewBox="0 0 128 150" width={190} height={222} aria-hidden="true">
              <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.12)" />
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf-tint-strong)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="#fff" opacity="0.9" />
              <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
              <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
              <path d="M54 72q6 5 12 0" fill="none" stroke="var(--leaf-edge)" strokeWidth={2.4} strokeLinecap="round" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
              <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
            </svg>
          </div></div>
          <div className="mo-disp mo-rise mt-5 text-[34px] font-black leading-tight" style={{ animationDelay: ".15s" }}>Твоя неделя в словах</div>
          <div className="mo-rise mt-3 text-base opacity-90" style={{ animationDelay: ".3s" }}>Нажми справа, чтобы смотреть</div>
        </div>
      )}

      {i === 1 && (
        <div className="absolute left-0 right-0 top-[200px] px-7">
          <div className="mo-rise text-lg font-bold opacity-90">Ты встретил в книгах</div>
          <div className="mo-disp wk-big mt-2.5 text-[110px] font-black leading-none">{newWords}</div>
          <div className="mo-disp mo-rise mt-1.5 text-2xl font-bold" style={{ animationDelay: ".15s" }}>новых слов</div>
          {moment.alreadyKnownCount > 0 && (
            <div className="mo-rise mt-8 inline-flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[17px] font-bold" style={{ background: "rgba(255,255,255,.18)", animationDelay: ".3s" }}>
              <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
                <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
              </svg>
              {moment.alreadyKnownCount} из них уже твои
            </div>
          )}
        </div>
      )}

      {i === 2 && (
        <div className="absolute left-0 right-0 top-[190px] px-7">
          <div className="text-lg font-bold opacity-90">Слово недели</div>
          {moment.wordOfWeek ? (
            <>
              <div className="wk-card mt-4 rounded-[28px] px-6 pb-7 pt-6 text-[#1a1a1a]" style={{ background: "#fff", boxShadow: "inset 0 -6px 0 0 rgba(0,0,0,.12)" }}>
                <div style={{ font: "700 38px/1.1 var(--font-reading), Georgia, serif" }}>{moment.wordOfWeek.headword}</div>
                <div className="mt-3 text-xl font-bold">{moment.wordOfWeek.translation}</div>
                {moment.wordOfWeek.contextSentence && (
                  <div className="mt-2.5 text-base text-[rgba(26,26,26,.75)]" style={{ fontFamily: "var(--font-reading), Georgia, serif" }}>{moment.wordOfWeek.contextSentence}</div>
                )}
              </div>
              <div className="mt-5 text-[17px] font-semibold">
                Встретил {moment.wordOfWeek.timesSeen} {moment.wordOfWeek.timesSeen === 1 ? "раз" : "раза"}, ошибся{" "}
                {moment.wordOfWeek.timesSeen - moment.wordOfWeek.timesCorrect}. Теперь оно твоё.
              </div>
            </>
          ) : (
            <div className="mt-4 text-base opacity-90">На этой неделе ещё не было повторений — слово недели появится позже.</div>
          )}
        </div>
      )}

      {i === 3 && (
        <>
          <div className="absolute left-0 right-0 top-[170px] px-7">
            <div className="mo-disp mo-rise text-[30px] font-black leading-tight">Неделя в цифрах</div>
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-baseline gap-3 rounded-2xl px-4.5 py-3.5" style={{ background: "rgba(26,26,26,.08)" }}>
                <span className="mo-disp min-w-[64px] text-[34px] font-black">{moment.minutesRead}</span>
                <span className="text-base font-bold">минут чтения</span>
              </div>
              <div className="flex items-baseline gap-3 rounded-2xl px-4.5 py-3.5" style={{ background: "rgba(26,26,26,.08)" }}>
                <span className="mo-disp min-w-[64px] text-[34px] font-black">{moment.chaptersRead}</span>
                <span className="text-base font-bold">главы прочитаны</span>
              </div>
              <div className="flex items-baseline gap-3 rounded-2xl px-4.5 py-3.5" style={{ background: "rgba(26,26,26,.08)" }}>
                <span className="mo-disp min-w-[64px] text-[34px] font-black">{moment.activeDays}/7</span>
                <span className="text-base font-bold">дней без пропуска</span>
              </div>
            </div>
          </div>
          <div className="mo-rise absolute bottom-0 left-0 right-0 z-[4] flex gap-3 px-5 pb-8" style={{ animationDelay: ".6s" }}>
            <button type="button" onClick={onClose} className="btn btn-md" style={{ ["--btn-fill" as string]: "rgba(26,26,26,.1)", ["--btn-edge" as string]: "rgba(26,26,26,.18)", ["--btn-label" as string]: "#1a1a1a", flex: 1, minHeight: 52 } as React.CSSProperties}>
              Готово
            </button>
            <button type="button" onClick={share} className="btn btn-md" style={{ ["--btn-fill" as string]: "#1a1a1a", ["--btn-edge" as string]: "#000", ["--btn-label" as string]: "#fff", flex: 2, minHeight: 52, gap: 8 } as React.CSSProperties}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
              {shared ? "Скопировано" : "Поделиться"}
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
