"use client";

import { useEffect, useState, useTransition } from "react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import SessionComplete from "./session-complete";

const ROUND_SIZE = 6;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Round {
  words: ReviewCard[];
  translations: ReviewCard[];
}

function buildRounds(cards: ReviewCard[]): Round[] {
  const rounds: Round[] = [];
  for (let i = 0; i < cards.length; i += ROUND_SIZE) {
    const roundCards = cards.slice(i, i + ROUND_SIZE);
    rounds.push({ words: shuffle(roundCards), translations: shuffle(roundCards) });
  }
  return rounds;
}

export default function MatchPairsMode({
  cards,
  missionId = null,
}: {
  cards: ReviewCard[];
  missionId?: string | null;
}) {
  // Раунды считаем один раз при монтировании, а не по эффекту на каждую смену раунда.
  const [rounds] = useState(() => buildRounds(cards));
  const [roundIndex, setRoundIndex] = useState(0);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<{ word: string; translation: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  // Тот же grade (0/2), что уходит в reviewWord() ниже — по одной записи на
  // пару в момент совпадения, накопленный счёт для миссии (§11-13).
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });
  // Найдено при повторном аудите: неверные попытки вообще не влияли на SRS
  // (не грейдились никак), а итоговое совпадение всегда шло с оценкой 2
  // ("Помню") — даже после нескольких ошибок подряд. Отмечаем участвовавшие
  // в ошибочной попытке карточки и снижаем итоговую оценку для них.
  const [struggledIds, setStruggledIds] = useState<Set<string>>(new Set());
  // M3 Slice 4.1: совпадение/ошибка раньше отличались только цветом рамки —
  // держим текстовое объявление для скринридера (озвучивается через
  // aria-live ниже), не меняя саму логику подбора пар/грейдинга.
  const [announcement, setAnnouncement] = useState("");

  const round = rounds[roundIndex];
  const allDone = roundIndex >= rounds.length;
  const roundDone = !allDone && matchedIds.size === round.words.length;

  useEffect(() => {
    if (!wrongFlash) return;
    const timer = setTimeout(() => {
      setWrongFlash(null);
      setSelectedWord(null);
      setSelectedTranslation(null);
    }, 700);
    return () => clearTimeout(timer);
  }, [wrongFlash]);

  if (allDone) {
    return (
      <SessionComplete
        count={cards.length}
        missionId={missionId}
        missionCorrectCount={tally.correct}
        missionIncorrectCount={tally.incorrect}
      />
    );
  }

  function resolveAttempt(wordId: string, translationId: string) {
    if (wordId === translationId) {
      setMatchedIds((s) => new Set(s).add(wordId));
      const grade = struggledIds.has(wordId) ? 0 : 2;
      setTally((t) => (grade === 2 ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
      startTransition(() => {
        void reviewWord(wordId, grade, "match");
      });
      setSelectedWord(null);
      setSelectedTranslation(null);
      setAnnouncement("Верно, пара найдена.");
    } else {
      setStruggledIds((s) => new Set(s).add(wordId).add(translationId));
      setSelectedWord(wordId);
      setSelectedTranslation(translationId);
      setWrongFlash({ word: wordId, translation: translationId });
      setAnnouncement("Неверно, попробуй ещё раз.");
    }
  }

  function pickWord(id: string) {
    if (matchedIds.has(id) || wrongFlash) return;
    if (selectedTranslation) {
      resolveAttempt(id, selectedTranslation);
    } else {
      setSelectedWord(id);
    }
  }

  function pickTranslation(id: string) {
    if (matchedIds.has(id) || wrongFlash) return;
    if (selectedWord) {
      resolveAttempt(selectedWord, id);
    } else {
      setSelectedTranslation(id);
    }
  }

  function nextRound() {
    setRoundIndex((i) => i + 1);
    setMatchedIds(new Set());
    setSelectedWord(null);
    setSelectedTranslation(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        Раунд {roundIndex + 1} из {rounds.length} · сопоставь слово и перевод
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="grid flex-1 grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {round.words.map((w) => {
            const matched = matchedIds.has(w.flashcardId);
            const isSelected = selectedWord === w.flashcardId;
            const isWrong = wrongFlash?.word === w.flashcardId;
            return (
              <button
                key={w.flashcardId}
                type="button"
                disabled={matched || !!wrongFlash}
                onClick={() => pickWord(w.flashcardId)}
                className={`flex items-center justify-between gap-1.5 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                  matched
                    ? "border-emerald-600 bg-emerald-50 opacity-50 dark:bg-emerald-950"
                    : isWrong
                      ? "border-red-500 bg-red-50 dark:bg-red-950"
                      : isSelected
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
                }`}
              >
                <span>{w.front}</span>
                {matched && (
                  <span aria-hidden="true" className="shrink-0 text-emerald-700 dark:text-emerald-400">
                    ✓
                  </span>
                )}
                {isWrong && (
                  <span aria-hidden="true" className="shrink-0 text-red-600 dark:text-red-400">
                    ✗
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          {round.translations.map((t) => {
            const matched = matchedIds.has(t.flashcardId);
            const isSelected = selectedTranslation === t.flashcardId;
            const isWrong = wrongFlash?.translation === t.flashcardId;
            return (
              <button
                key={t.flashcardId}
                type="button"
                disabled={matched || !!wrongFlash}
                onClick={() => pickTranslation(t.flashcardId)}
                className={`flex items-center justify-between gap-1.5 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                  matched
                    ? "border-emerald-600 bg-emerald-50 opacity-50 dark:bg-emerald-950"
                    : isWrong
                      ? "border-red-500 bg-red-50 dark:bg-red-950"
                      : isSelected
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
                }`}
              >
                <span>{t.back}</span>
                {matched && (
                  <span aria-hidden="true" className="shrink-0 text-emerald-700 dark:text-emerald-400">
                    ✓
                  </span>
                )}
                {isWrong && (
                  <span aria-hidden="true" className="shrink-0 text-red-600 dark:text-red-400">
                    ✗
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {roundDone && (
        <button
          type="button"
          disabled={isPending}
          onClick={nextRound}
          className="mt-4 rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Далее
        </button>
      )}
    </div>
  );
}
