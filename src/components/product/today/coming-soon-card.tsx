import { Target, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

// Disabled/coming-soon entry points — визуально второстепенные, явно
// помечены "Скоро", не кликабельны (никакой fake-функциональности за
// ними). Не Missions engine, не AI Platform — см. явные ограничения задания.
// M3 Slice 5: "Языковой профиль" убран отсюда — это было место-держатель
// для Language Twin, который теперь реально реализован и живёт в
// /language-twin (см. LanguageTwinSummaryCard на этой же странице).
//
// redesign/duolingo-flat phase 2: emoji icon-строки → lucide, единая
// иконочная система. Phase 6: Card с пунктирной рамкой без заливки —
// "ещё не существует" читается отличием от сплошных ячеек вокруг.
const ITEMS = [
  { icon: Target, label: "Персональные миссии" },
  { icon: MessageCircle, label: "AI-разговор" },
];

export default function ComingSoonCard({ className }: { className?: string }) {
  return (
    <Card className={`border-dashed bg-transparent ${className ?? ""}`}>
      <p className="text-caption mb-2">Скоро</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
        {ITEMS.map((item) => (
          <li key={item.label} className="flex items-center gap-2 py-1 text-sm text-[var(--text-secondary)]">
            <item.icon aria-hidden="true" className="h-4 w-4" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
