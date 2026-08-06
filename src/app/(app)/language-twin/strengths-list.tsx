"use client";

import { useState } from "react";
import { track } from "@/lib/posthog-client";
import Dialog from "@/components/product/language-twin/dialog";

interface Strength {
  title: string;
  evidence: string;
}

// Strengths don't have their own id/confidence/trend the way error patterns
// do (recompute.ts's strengths_json is a plain {title, evidence} list) — the
// detail dialog is honest about that rather than fabricating a confidence
// badge to match PatternDetail's layout.
export default function StrengthsList({ strengths }: { strengths: Strength[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (strengths.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">Пока недостаточно данных.</p>;
  }

  return (
    <>
      {strengths.slice(0, 2).map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            track("strength_opened", {});
            setOpenIndex(i);
          }}
          className="focus-ring flex items-start gap-2 rounded-lg p-1 text-left hover:bg-[var(--surface-muted)]"
        >
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)]" />
          <p className="text-sm">{s.title}</p>
        </button>
      ))}
      {openIndex !== null && (
        <Dialog titleId="strength-detail-title" title={strengths[openIndex].title} onClose={() => setOpenIndex(null)}>
          <div className="flex flex-col gap-3 text-sm">
            <p>{strengths[openIndex].evidence}</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Сильные стороны считаются проще паттернов ошибок — без отдельного счётчика уверенности или
              тренда, но так же на основе твоих реальных данных, а не догадки.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
