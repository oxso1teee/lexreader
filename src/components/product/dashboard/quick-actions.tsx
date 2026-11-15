import { BookOpen, Brain, Plus, Swords, Target, type LucideIcon } from "lucide-react";
import { CardLink } from "@/components/ui/card";

// Быстрый доступ к основным разделам. Только реально существующие маршруты;
// «Практика» ведёт в раздел «Мозг», повторение отдельной кнопкой не дублируем
// (оно и так главное действие дня, когда есть что повторять).
const ACTIONS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/library/new", label: "Новый текст", Icon: Plus },
  { href: "/library", label: "Библиотека", Icon: BookOpen },
  { href: "/brain", label: "Практика", Icon: Brain },
  { href: "/missions", label: "Миссии", Icon: Target },
  { href: "/duel", label: "Дуэль", Icon: Swords },
];

export default function QuickActions() {
  return (
    <section aria-labelledby="dash-quick-title" className="flex flex-col gap-3">
      <h2
        id="dash-quick-title"
        className="m-0 text-xs font-bold tracking-[0.06em] text-[var(--text-secondary)] uppercase"
      >
        Быстрый доступ
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 @xl:grid-cols-3">
        {ACTIONS.map(({ href, label, Icon }) => (
          <li key={href}>
            <CardLink href={href} className="flex items-center gap-3 !p-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--leaf-tint)] text-[var(--leaf-text)]"
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 truncate text-sm font-bold">{label}</span>
            </CardLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
