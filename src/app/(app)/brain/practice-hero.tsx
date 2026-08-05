"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { loadReviewSession, clearReviewSession } from "@/lib/review-session-resume";

// useSyncExternalStore (not useState+useEffect): server and the first client
// render honestly agree on "no resumable session" (localStorage doesn't
// exist on the server) with no hydration mismatch, and the real value is
// substituted in a separate, already-client step — same pattern as
// src/app/read/[textId]/reader-settings.tsx's useReaderPrefs.
function subscribe(): () => void {
  return () => {};
}

function getServerSnapshot(): null {
  return null;
}

// Practice Home main review card (Slice 4 §5). A client component because
// "interrupted session" can only be known from localStorage — the server
// render always shows the honest default (due/new counts, no resume banner)
// first, then this upgrades in place once mounted if a resumable session
// exists.
export default function PracticeHero({
  userId,
  dueCount,
  newCount,
  estMinutes,
}: {
  userId: string;
  dueCount: number;
  newCount: number;
  estMinutes: number;
}) {
  const session = useSyncExternalStore(
    subscribe,
    () => loadReviewSession(userId, "all"),
    getServerSnapshot,
  );
  // "Отменить" clears the underlying storage immediately, but this component
  // isn't subscribed to storage-change events (single-tab, one-shot read) —
  // dismissed suppresses the banner locally without needing a full store.
  const [dismissed, setDismissed] = useState(false);
  const resumable = session && !dismissed ? { remaining: session.cardIds.length - session.index } : null;

  const total = dueCount + newCount;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-caramel to-caramel-light p-4 text-white shadow-sm">
      {resumable ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Незавершённая сессия</p>
            <p className="font-medium">Осталось {resumable.remaining} карточек</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearReviewSession();
                setDismissed(true);
              }}
              className="rounded-full border border-white/40 px-3 py-2 text-sm font-medium"
            >
              Отменить
            </button>
            <Link
              href="/brain/all/review"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Продолжить
            </Link>
          </div>
        </div>
      ) : total > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Готово к повторению</p>
            <p className="font-medium">
              {total} {cardsWord(total)} · ~{estMinutes} мин
            </p>
            <p className="text-sm text-white/80">
              {dueCount} к повторению{newCount > 0 ? ` · ${newCount} новых` : ""}
            </p>
          </div>
          <Link
            href="/brain/all/review"
            className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Повторить сейчас →
          </Link>
        </div>
      ) : (
        <p className="font-medium">🎉 Всё повторено!</p>
      )}
    </div>
  );
}

function cardsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "карточка";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "карточки";
  return "карточек";
}
