import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AnsweredResult } from "@/lib/lessons/attempt-state";

// Обратная связь после ответа: верно/неверно, правильный ответ, объяснение.
// Контейнер role="status" есть всегда (даже пустой) — живая область должна
// существовать до появления текста, иначе скринридер его не озвучит. Состояние
// несут иконка и слова, не только цвет.
export default function FeedbackPanel({ result }: { result: AnsweredResult | null }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {result && (
        <Card tone={result.verdict.correct ? "leaf" : "danger"} className="ls-feedback" data-correct={result.verdict.correct}>
          <p className="ls-feedback-title">
            {result.verdict.correct ? (
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            ) : (
              <XCircle aria-hidden="true" className="h-5 w-5" />
            )}
            {result.verdict.correct ? "Верно!" : "Неверно"}
          </p>
          {!result.verdict.correct && (
            <p className="text-sm">
              Правильный ответ: <strong>{result.verdict.correctAnswer}</strong>
            </p>
          )}
          <p className="text-sm">{result.verdict.explanation}</p>
        </Card>
      )}
    </div>
  );
}
