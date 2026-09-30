import { BookOpen, Brain, Swords } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// redesign/duolingo-flat, phase 6 — ячейка "Быстрые действия" на /home: три
// реально существующих раздела. Повторение сюда намеренно не входит — оно
// уже главный CTA hero, когда есть due-слова (второй "Повторить" на экране
// ещё и конкурировал бы с ним).
const ACTIONS = [
  { href: "/library", label: "Библиотека", icon: BookOpen },
  { href: "/brain", label: "Практика", icon: Brain },
  { href: "/duel", label: "Дуэль", icon: Swords },
];

export default function QuickActionsCard({ className }: { className?: string }) {
  return (
    <Card className={`flex flex-col gap-3 ${className ?? ""}`}>
      <p className="text-sm font-bold">Быстрые действия</p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <ButtonLink key={a.href} href={a.href} variant="ghost" size="sm" pill>
            <a.icon aria-hidden="true" className="h-4 w-4" />
            {a.label}
          </ButtonLink>
        ))}
      </div>
    </Card>
  );
}
