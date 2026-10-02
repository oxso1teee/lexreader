"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

const FAQ = [
  {
    q: "Можно отменить в любой момент?",
    a: "Да. Доступ сохранится до конца уже оплаченного периода, автопродление просто не сработает.",
  },
  {
    q: "Что будет с моими словами и карточками при отмене?",
    a: "Ничего не удаляется — просто вернутся лимиты бесплатного тарифа.",
  },
  {
    q: "Как работает пробный период?",
    a: "3 дня полного доступа бесплатно. Если не отменишь до конца пробного периода, спишется обычная цена тарифа.",
  },
];

// Раздел 5 промта 2026-07-30 (запуск): короткий блок доверия перед оплатой —
// снимает типичные вопросы, которые иначе задерживают решение об оплате.
export default function PricingFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {FAQ.map((item, i) => (
        <Card key={item.q}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between text-left text-sm font-medium"
          >
            {item.q}
            <span className="text-[var(--text-secondary)]">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.a}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
