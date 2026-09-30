"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { track } from "@/lib/posthog-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { checkCorrectionAction, saveCorrectionEvidenceAction, type CorrectionCheckResult } from "../actions";
import { categoryLabel } from "@/components/product/language-twin/badges";
import type { PatternCategory } from "@/lib/language-twin/types";

const CONFIDENCE_LABEL: Record<string, string> = { low: "Уверенность: низкая", medium: "Уверенность: средняя", high: "Уверенность: высокая" };

export default function CorrectionForm() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CorrectionCheckResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedPatternTitle, setSavedPatternTitle] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheck() {
    setSaved(false);
    setSavedPatternTitle(null);
    track("correction_check_started", {});
    startTransition(async () => {
      const res = await checkCorrectionAction(text);
      track("correction_check_completed", { supported: res.supported, match_count: res.matches.length });
      setResult(res);
    });
  }

  function handleSave() {
    if (!result) return;
    startTransition(async () => {
      const res = await saveCorrectionEvidenceAction(text, result);
      setSaved(res.ok);
      setSavedPatternTitle(res.patternTitle ?? null);
    });
  }

  function handleClear() {
    setText("");
    setResult(null);
    setSaved(false);
    setSavedPatternTitle(null);
  }

  return (
    <Card>
      <label htmlFor="correction-input" className="mb-1 block text-sm font-medium">
        Твоё предложение
      </label>
      <textarea
        id="correction-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={400}
        rows={3}
        placeholder="Например: It depends of the weather."
        className="focus-ring w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-2 text-sm outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="leaf" size="sm" onClick={handleCheck} disabled={isPending || text.trim().length === 0}>
          {isPending ? "Проверяем…" : "Проверить"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Очистить
        </Button>
      </div>

      {result && (
        <div role="status" className="mt-4 flex flex-col gap-3">
          {!result.supported && (
            <p className="rounded-lg bg-[var(--color-warning)]/10 p-3 text-sm">
              Мы пока не можем надёжно проверить этот текст (пустое, слишком длинное или не на английском) —
              без внешней ИИ-модели это вне того, что поддерживает эта проверка.
            </p>
          )}
          {result.supported && result.matches.length === 0 && (
            <p className="rounded-lg bg-[var(--color-success)]/10 p-3 text-sm">
              Известных паттернов не найдено. Это не значит «предложение проверено полностью» — если ошибка
              в нём есть, но другого типа, этот тип ошибки пока не поддерживается: проверка охватывает
              только небольшой список известных паттернов, а не полный грамматический разбор.
            </p>
          )}
          {result.supported &&
            result.matches.map((m, i) => (
              <div key={i} className="rounded-lg bg-[var(--surface-muted)] p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-[var(--color-forest-text)]">
                    {categoryLabel(m.category as PatternCategory)}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {CONFIDENCE_LABEL[m.confidence] ?? m.confidence}
                  </span>
                </div>
                <p className="text-sm">{m.explanation}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Вариант: <strong className="text-[var(--foreground)]">{m.suggestion}</strong>
                </p>
              </div>
            ))}
          {result.supported && result.matches.length > 0 && (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleSave} disabled={isPending || saved} className="gap-1.5">
                {saved && <Check aria-hidden="true" className="h-4 w-4" />}
                {saved ? "Сохранено в профиль" : "Сохранить в профиль"}
              </Button>
            </div>
          )}
          {saved && (
            <p className="rounded-lg bg-[var(--color-success)]/10 p-3 text-sm">
              {savedPatternTitle ? (
                <>
                  Сохранено — это укрепило паттерн «{savedPatternTitle}» в твоём профиле.{" "}
                  <Link href="/language-twin" className="font-medium underline underline-offset-2">
                    Посмотреть профиль →
                  </Link>
                </>
              ) : (
                "Сохранено как реальный сигнал в твоём профиле."
              )}
            </p>
          )}
          <p className="text-xs text-[var(--text-secondary)]">
            Это может быть неточно — проверь смысл сам, прежде чем полагаться на подсказку.
          </p>
        </div>
      )}
    </Card>
  );
}
