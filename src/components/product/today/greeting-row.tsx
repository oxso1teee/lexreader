import Link from "next/link";
import { Menu } from "lucide-react";

// Today mockup alignment — заменяет PageHeader на /home двухстрочным
// приветствием (мелкая faint-строка сверху / крупная bold снизу) +
// круглая icon-кнопка справа. greeting/dateLabel — те же значения, что
// раньше шли в PageHeader title/description (greetingForHour() не
// тронута, "профиль не хранит имя — приветствие всегда безличное", см.
// src/lib/today.ts) — только porядок и вес текста поменялись местами:
// дата — мелкая faint-строка сверху, приветствие — крупная строка снизу
// (референс хотел "имя" во второй строке, которого у профиля нет; дата —
// единственная другая реальная строка, которая честно занимает эту
// позицию, ничего не выдумываем).
//
// Кнопка справа — референс просто описывает "иконка меню", без
// поведения. В приложении нет отдельного бокового меню/drawer на
// мобильном (это была бы новая функциональность за пределами
// презентационного слоя) — ведёт на /settings, единственный реальный
// экран-меню/профиль, который уже есть в навигации.
export default function GreetingRow({ dateLabel, greeting }: { dateLabel: string; greeting: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-secondary)]">{dateLabel}</p>
        <h1 className="text-[22px] leading-[1.2] font-bold">{greeting}</h1>
      </div>
      <Link
        href="/settings"
        aria-label="Меню"
        className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-card"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </Link>
    </div>
  );
}
