"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Volume2 } from "lucide-react";
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
          className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-label="Прогресс занятия"
          aria-valuemin={0}
          aria-valuemax={cards.length}
          aria-valuenow={index}
        >
          <div
            className="h-full rounded-full bg-[var(--color-forest)] transition-[width] duration-300"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sky-text)" }}>
        Аудирование · задание {index + 1} из {cards.length}
      </div>
      <h1 className="mo-disp" style={{ margin: "8px 0 0", fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>
        Напиши, что услышишь
      </h1>

      <div className="mt-8 flex items-center justify-center gap-3.5">
        <button
          type="button"
          onClick={() => speak(1)}
          aria-label="Прослушать"
          disabled={checked}
          className="flex h-[110px] w-[110px] items-center justify-center rounded-[28px] text-white disabled:opacity-60"
          style={{ background: "var(--sky)", boxShadow: "inset 0 -6px 0 0 var(--sky-edge)" }}
        >
          <Volume2 aria-hidden="true" className="h-10 w-10" />
        </button>
        <button
          type="button"
          onClick={() => speak(0.5)}
          aria-label="Прослушать медленно"
          disabled={checked}
          className="flex h-[64px] w-[64px] items-center justify-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface)] text-sm font-bold text-[var(--sky-text)] disabled:opacity-60"
          style={{ boxShadow: "inset 0 -4px 0 0 var(--border)" }}
        >
          0.5×
        </button>
      </div>

      <label htmlFor="listen-answer" className="mt-7 block text-[13px] font-semibold text-[var(--text-secondary)]">
        Твой ответ
      </label>
      <textarea
        id="listen-answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={checked}
        autoFocus
        rows={3}
        placeholder="Напиши, что услышал"
        className={`mt-2 min-h-[100px] w-full resize-none rounded-2xl border-2 px-4 py-3 text-lg outline-none disabled:opacity-70 ${
          checked
            ? isCorrect
              ? "border-[var(--color-forest)] bg-[var(--color-forest-tint)]"
              : "border-[var(--color-danger-text)] bg-[var(--danger-tint)]"
            : "border-[var(--color-forest)] focus:border-[var(--color-forest)]"
        }`}
      />
      <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Регистр и знаки препинания не важны</p>

      {checked && (
        <p role="status" aria-live="polite" className={`mt-3 flex items-center gap-1.5 font-medium ${isCorrect ? "text-[var(--color-forest-text)]" : "text-[var(--color-danger-text)]"}`}>
          {isCorrect ? <Check aria-hidden="true" className="h-4 w-4" /> : <X aria-hidden="true" className="h-4 w-4" />}
          {isCorrect ? `Верно! +${xpAwarded} XP` : `Правильный ответ: ${card.front}`}
        </p>
      )}

      {!checked ? (
        <Button variant="leaf" onClick={check} disabled={value.trim() === ""} className="mt-5">
          Проверить
        </Button>
      ) : (
        <Button variant={isCorrect ? "leaf" : "danger"} disabled={isPending} onClick={next} className="mt-5">
          {isCorrect ? "Продолжить" : "Понятно"}
        </Button>
      )}
    </div>
  );
}
