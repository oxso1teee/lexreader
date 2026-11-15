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
const SLIDE_BG = ["var(--leaf)", "var(--sky)", "var(--ember)", "var(--sun)"];
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

  const newWords = useCountUp(moment.newWordsCount, { delay: 100, duration: 900 });

  return (
    <div className="mo-screen" style={{ "--mo-bg": SLIDE_BG[i], "--mo-fg": SLIDE_FG[i] } as React.CSSProperties}>
      <div className="relative z-[3] px-3.5 pt-12">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: i === 3 ? "rgba(26,26,26,.2)" : "rgba(255,255,255,.35)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: i === 3 ? "#1a1a1a" : "#fff",
                  width: k < i ? "100%" : k === i ? "100%" : "0%",
                  transition: k === i ? `width ${SLIDE_SECONDS}s linear` : undefined,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2.5">
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
          <div className="mo-bob mx-auto w-fit">
            <svg viewBox="0 0 128 150" width={190} height={222} aria-hidden="true">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf-tint-strong)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="#fff" opacity="0.9" />
              <path d="M54 72q6 5 12 0" fill="none" stroke="var(--leaf-deep)" strokeWidth={2.4} strokeLinecap="round" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            </svg>
          </div>
          <div className="mt-5 text-[34px] font-black leading-tight">Твоя неделя в словах</div>
          <div className="mt-3 text-base opacity-90">Нажми справа, чтобы смотреть</div>
        </div>
      )}

      {i === 1 && (
        <div className="absolute left-0 right-0 top-[200px] px-7">
          <div className="text-lg font-bold opacity-90">Ты встретил в книгах</div>
          <div className="mt-2.5 text-[110px] font-black leading-none">{newWords}</div>
          <div className="mt-1.5 text-2xl font-bold">новых слов</div>
          {moment.alreadyKnownCount > 0 && (
            <div className="mt-8 inline-flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[17px] font-bold" style={{ background: "rgba(255,255,255,.18)" }}>
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
              <div className="mo-cardin mt-4 rounded-[28px] px-6 py-6 text-[#1a1a1a]" style={{ background: "#fff" }}>
                <div className="font-serif text-[36px] leading-tight">{moment.wordOfWeek.headword}</div>
                <div className="mt-3 text-xl font-bold">{moment.wordOfWeek.translation}</div>
                {moment.wordOfWeek.contextSentence && (
                  <div className="mt-2.5 font-serif text-base text-[rgba(26,26,26,.75)]">{moment.wordOfWeek.contextSentence}</div>
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
            <div className="text-[30px] font-black leading-tight">Неделя в цифрах</div>
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-baseline gap-3 rounded-2xl px-4.5 py-3.5" style={{ background: "rgba(26,26,26,.08)" }}>
                <span className="min-w-[64px] text-[34px] font-black">{moment.minutesRead}</span>
                <span className="text-base font-bold">минут чтения</span>
              </div>
              <div className="flex items-baseline gap-3 rounded-2xl px-4.5 py-3.5" style={{ background: "rgba(26,26,26,.08)" }}>
                <span className="min-w-[64px] text-[34px] font-black">{moment.chaptersRead}</span>
                <span className="text-base font-bold">главы прочитаны</span>
              </div>
              <div className="flex items-baseline gap-3 rounded-2xl px-4.5 py-3.5" style={{ background: "rgba(26,26,26,.08)" }}>
                <span className="min-w-[64px] text-[34px] font-black">{moment.activeDays}/7</span>
                <span className="text-base font-bold">дней без пропуска</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 z-[4] px-5 pb-8">
            <button type="button" onClick={onClose} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl px-5 font-bold" style={{ background: "rgba(26,26,26,.1)", color: "#1a1a1a" }}>
              Готово
            </button>
          </div>
        </>
      )}
    </div>
  );
}
