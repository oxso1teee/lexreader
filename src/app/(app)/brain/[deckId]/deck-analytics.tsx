"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

// Тот же паттерн клиент-трекера, что и PracticeAnalytics (../practice-analytics.tsx) —
// только deck_type/card_count, никогда имя колоды или её id.
//
// M3 Slice 4 §16: createDeck() серверный экшен успешно завершается через
// redirect() — useActionState в new-deck-modal.tsx никогда не видит успешный
// state (redirect прерывает выполнение раньше). ?created=true в целевом URL —
// единственный надёжный сигнал успеха на клиенте, без него
// deck_create_succeeded пришлось бы либо выдумывать, либо не отправлять
// вовсе.
export default function DeckAnalytics({
  deckType,
  cardCount,
  justCreated,
}: {
  deckType: "default" | "starter" | "custom";
  cardCount: number;
  justCreated: boolean;
}) {
  useEffect(() => {
    if (justCreated) {
      track("deck_create_succeeded", { deck_type: deckType });
    }
    track("deck_opened", { deck_type: deckType, card_count: cardCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
