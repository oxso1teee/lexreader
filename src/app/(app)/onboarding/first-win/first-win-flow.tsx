"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tokenizeSentence } from "@/lib/tokenize";
import { coverGradient, coverEmoji } from "@/lib/text-cover";
import { saveFirstWinWord, completeFirstWin } from "./actions";

interface FirstWinText {
  id: string;
  title: string;
  body: string;
  wordCount: number | null;
  levelTag: string | null;
}

interface SavedWord {
  headword: string;
  translation: string;
}

const WORDS_TO_SAVE = 3;

export default function FirstWinFlow({ texts }: { texts: FirstWinText[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"pick" | "read" | "review" | "done">("pick");
  const [selected, setSelected] = useState<FirstWinText | null>(null);
  const [saved, setSaved] = useState<SavedWord[]>([]);
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const savedHeadwords = new Set(saved.map((s) => s.headword.toLowerCase()));

  async function handleWordTap(word: string) {
    const key = word.toLowerCase();
    if (savedHeadwords.has(key) || savingWord || saved.length >= WORDS_TO_SAVE) return;
    setSavingWord(word);
    const result = await saveFirstWinWord(word);
    setSavingWord(null);
    if (!result.ok) return;
    setSaved((prev) => {
      const next = [...prev, { headword: word, translation: result.translation ?? "" }];
      if (next.length >= WORDS_TO_SAVE) setStep("review");
      return next;
    });
  }

  async function handleFinish() {
    setFinishing(true);
    await completeFirstWin();
    router.push("/home");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <div className="mb-6 flex gap-1.5">
        {["pick", "read", "review", "done"].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              ["pick", "read", "review", "done"].indexOf(step) >= ["pick", "read", "review", "done"].indexOf(s)
                ? "bg-black dark:bg-white"
                : "bg-black/10 dark:bg-white/15"
            }`}
          />
        ))}
      </div>

      {step === "pick" && (
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-xl font-semibold">Выбери текст, чтобы начать</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Что-то короткое — прочитаешь за пару минут и сразу попробуешь, как всё работает.
          </p>
          <div className="flex flex-col gap-2">
            {texts.map((t) => {
              const [a, b] = coverGradient(t.title);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelected(t);
                    setStep("read");
                  }}
                  className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3 text-left transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl"
                    style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                  >
                    {coverEmoji(t.title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-sm text-black/50 dark:text-white/50">
                      {t.wordCount ?? "?"} слов{t.levelTag ? ` · ${t.levelTag}` : ""}
                    </p>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "read" && selected && (
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold">{selected.title}</h1>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              Тапни 2-3 незнакомых слова, чтобы сохранить их — {saved.length}/{WORDS_TO_SAVE} сохранено
            </p>
          </div>
          <div className="flex-1 text-lg leading-8">
            {tokenizeSentence(selected.body).map((tok, i) => {
              if (!tok.isWord) return <span key={i}>{tok.text}</span>;
              const key = tok.text.toLowerCase();
              const isSaved = savedHeadwords.has(key);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={savingWord === tok.text || saved.length >= WORDS_TO_SAVE}
                  onClick={() => handleWordTap(tok.text)}
                  className={`rounded px-0.5 transition-colors ${
                    isSaved
                      ? "bg-emerald-200 dark:bg-emerald-800"
                      : savingWord === tok.text
                        ? "bg-black/10 dark:bg-white/15"
                        : "hover:bg-black/10 dark:hover:bg-white/15"
                  }`}
                >
                  {tok.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black/50 dark:bg-white/10 dark:text-white/50">
            Повтори прямо сейчас
          </p>
          <div className="rounded-lg border border-black/10 px-8 py-6 dark:border-white/15">
            <p className="text-2xl font-semibold">{saved[saved.length - 1]?.headword}</p>
            {revealed && (
              <p className="mt-2 text-lg text-black/60 dark:text-white/60">
                {saved[saved.length - 1]?.translation}
              </p>
            )}
          </div>
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
            >
              Показать перевод
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep("done")}
              className="rounded-full bg-caramel px-5 py-3 font-medium text-white"
            >
              Понял(а)
            </button>
          )}
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-3xl">🎉</p>
          <h1 className="text-xl font-semibold">Ты прошёл весь цикл!</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Прочитал текст, сохранил {saved.length} слова и повторил одно из них — именно так это
            работает каждый день.
          </p>
          <button
            type="button"
            onClick={handleFinish}
            disabled={finishing}
            className="mt-4 rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {finishing ? "…" : "На Главную"}
          </button>
        </div>
      )}
    </div>
  );
}
