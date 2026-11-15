"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import { Button } from "@/components/ui/button";
import SessionComplete from "./session-complete";
import { useMoments } from "@/components/product/moments/moment-provider";
import { haptic, playReviewSound } from "@/lib/native";
import { checkListenAnswer } from "@/lib/lesson-exercises";

// docs/moments/mockups/Lesson-listen.dc.html — "Напиши, что услышишь":
// speechSynthesis произносит card.front (всегда изучаемый язык — тот же
// выбор, что и во всех остальных режимах review/*), пользователь печатает
// ответ с нуля, сравнение — без учёта регистра/пунктуации.

// Тот же паттерн, что в review-session.tsx/multiple-choice-mode.tsx —
// useSyncExternalStore, не голый `typeof window` (hydration mismatch).
function subscribeNoop(): () => void {
  return () => {};
}
function getSpeechSnapshot(): boolean {
  return "speechSynthesis" in window;
}
function getSpeechServerSnapshot(): boolean {
  return false;
}

export default function LessonListenMode({
  cards,
  targetLanguage,
  missionId = null,
}: {
  cards: ReviewCard[];
  targetLanguage: string;
  missionId?: string | null;
}) {
  const router = useRouter();
  const { pushMoments } = useMoments();
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [xpAwarded, setXpAwarded] = useState(0);
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });
  const [combo, setCombo] = useState(0);
  const speechAvailable = useSyncExternalStore(subscribeNoop, getSpeechSnapshot, getSpeechServerSnapshot);

  const done = index >= cards.length;
  const card = cards[index];

  if (done) {
    return (
      <SessionComplete
        count={cards.length}
        missionId={missionId}
        missionCorrectCount={tally.correct}
        missionIncorrectCount={tally.incorrect}
      />
    );
  }

  if (!speechAvailable) {
    // Lesson-listen.dc.html само предлагает "Не могу слушать" как выход —
    // здесь честно весь режим недоступен, если в браузере вообще нет
    // Web Speech API (SSR always hits this branch too, see
    // getSpeechServerSnapshot above — the "Проверить" flow below never
    // runs without it, so there's nothing for a user to silently lose).
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-xl font-semibold">Озвучка недоступна</p>
        <p className="text-[var(--text-secondary)]">
          Этот браузер не поддерживает синтез речи. Попробуй другой режим.
        </p>
      </div>
    );
  }

  const isCorrect = checked && checkListenAnswer(value, card.front);

  function speak(rate: number) {
    const utterance = new SpeechSynthesisUtterance(card.front);
    utterance.lang = targetLanguage;
    utterance.rate = rate;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function check() {
    if (checked || value.trim() === "") return;
    const correct = checkListenAnswer(value, card.front);
    setChecked(true);
    setTally((t) => (correct ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
    setCombo((c) => (correct ? c + 1 : 0));
    void haptic(correct ? "success" : "warning");
    playReviewSound(correct ? "correct" : "incorrect");
    startTransition(async () => {
      try {
        const result = await reviewWord(card.flashcardId, correct ? 2 : 0, "listen");
        setXpAwarded(result.xpAwarded);
        if (result.moments.length > 0) pushMoments(result.moments);
      } catch {
        setXpAwarded(0);
      }
    });
  }

  // "Не могу слушать" (макет): карточка пропускается без оценки — не
  // засчитываем ни верно, ни неверно, интервал повторения не трогаем.
  function skip() {
    window.speechSynthesis?.cancel();
    setValue("");
    setIndex((i) => i + 1);
  }

  function next() {
    setValue("");
    setChecked(false);
    setXpAwarded(0);
    setIndex((i) => i + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6">
      <div className="mb-5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => router.push("/brain")}
          aria-label="Закрыть занятие"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-foreground"
        >
          <X aria-hidden="true" className="h-6 w-6" />
        </button>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="progressbar"
          aria-label="Прогресс занятия"
          aria-valuemin={0}
          aria-valuemax={cards.length}
          aria-valuenow={index}
        >
          <div
            className="mc-fill h-full rounded-full bg-[var(--leaf)] transition-[width] duration-300"
            style={{ width: `${(index / cards.length) * 100}%`, boxShadow: "inset 0 -4px 0 0 rgba(0,0,0,.12)" }}
          />
        </div>
        <span
          aria-label="Серия верных ответов"
          className="flex shrink-0 items-center gap-1 pr-1.5 text-[15px] font-bold"
          style={{ color: combo > 0 ? "#c2410c" : "rgba(26,26,26,.5)" }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill={combo > 0 ? "var(--ember)" : "#d6cfc3"} />
          </svg>
          {combo}
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sky-text)" }}>
        Аудирование · задание {index + 1} из {cards.length}
      </div>
      <h1 className="mo-disp" style={{ margin: "8px 0 0", fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>
        Напиши, что услышишь
      </h1>

      <div className="flex items-center justify-center gap-3.5" style={{ marginTop: 34 }}>
        <button
          type="button"
          onClick={() => speak(1)}
          aria-label="Прослушать"
          disabled={checked}
          className="flex items-center justify-center disabled:opacity-60"
          style={{ width: 132, height: 132, borderRadius: 32, background: "#0b79b0", boxShadow: "inset 0 -8px 0 0 #075a85", gap: 6, paddingBottom: 8 }}
        >
          {[26, 44, 58, 40, 24].map((h, i) => (
            <span key={i} className="ll-wv" style={{ height: h, animationDelay: `${i * 0.15}s` }} aria-hidden="true" />
          ))}
        </button>
        <button
          type="button"
          onClick={() => speak(0.5)}
          aria-label="Прослушать медленно"
          disabled={checked}
          className="flex items-center justify-center border-2 border-[var(--border-strong)] bg-[var(--surface)] text-[17px] font-bold text-[var(--sky-text)] disabled:opacity-60"
          style={{ width: 76, height: 76, borderRadius: 22, boxShadow: "inset 0 -4px 0 0 rgba(26,26,26,.12)" }}
        >
          0.5×
        </button>
      </div>

      <label htmlFor="listen-answer" className="block text-[13px] font-semibold text-[var(--text-secondary)]" style={{ marginTop: 34 }}>
        Твой ответ
      </label>
      <textarea
        id="listen-answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={checked}
        autoFocus
        rows={4}
        placeholder="Напиши, что услышал"
        className={`mt-2 min-h-[150px] w-full resize-none rounded-[20px] border-2 bg-[var(--surface)] p-4 text-xl leading-snug outline-none disabled:opacity-70 ${
          checked
            ? isCorrect
              ? "border-[var(--color-forest)] bg-[var(--color-forest-tint)]"
              : "border-[var(--color-danger-text)] bg-[var(--danger-tint)]"
            : "border-[var(--border-strong)] focus:border-[var(--leaf)] focus:shadow-[0_0_0_4px_var(--leaf-tint)]"
        }`}
      />
      <p className="mt-2.5 text-[13px] text-[var(--text-secondary)]" style={{ paddingBottom: 120 }}>Регистр и знаки препинания не важны</p>

      {!checked ? (
        <div
          className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-md gap-3 px-5 pb-[calc(34px+env(safe-area-inset-bottom))] pt-[18px]"
          style={{ background: "var(--background)", borderTop: "2px solid var(--border)" }}
        >
          <Button variant="ghost" onClick={skip} style={{ flex: "0 0 auto", paddingLeft: 18, paddingRight: 18, minHeight: 52 }}>
            Не могу слушать
          </Button>
          <Button
            variant="leaf"
            onClick={check}
            disabled={value.trim() === ""}
            style={{ flex: 1, minHeight: 52, ...(value.trim() === "" ? { ["--btn-fill" as string]: "var(--surface-muted)", ["--btn-edge" as string]: "#d6cfc3", ["--btn-label" as string]: "var(--text-secondary)", opacity: 1 } : {}) }}
          >
            Проверить
          </Button>
        </div>
      ) : (
        <div
          className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4"
          style={{ background: isCorrect ? "var(--color-forest-tint)" : "var(--danger-tint)", animation: "mo-rise 0.22s ease-out" }}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, background: "var(--surface)", color: isCorrect ? "var(--color-forest)" : "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              {isCorrect ? <Check aria-hidden="true" className="h-6 w-6" strokeWidth={3} /> : <X aria-hidden="true" className="h-6 w-6" strokeWidth={3} />}
            </div>
            <div style={{ flex: 1 }}>
              <div className="mo-disp" style={{ fontSize: 20, fontWeight: 700, color: isCorrect ? "var(--color-forest-text)" : "var(--color-danger-text)" }}>
                {isCorrect ? "Отлично!" : "Правильный ответ:"}
              </div>
              {isCorrect ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-forest-text)" }}>+{xpAwarded} XP</div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-danger-text)", marginTop: 4 }}>{card.front}</div>
              )}
            </div>
          </div>
          <Button variant={isCorrect ? "leaf" : "danger"} disabled={isPending} onClick={next} className="mo-cta">
            {isCorrect ? "Продолжить" : "Понятно"}
          </Button>
        </div>
      )}
    </div>
  );
}
