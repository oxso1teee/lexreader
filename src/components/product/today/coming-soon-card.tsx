// Disabled/coming-soon entry points — визуально второстепенные, явно
// помечены "Скоро", не кликабельны (никакой fake-функциональности за
// ними). Не Missions engine, не AI Platform, не Language Twin backend —
// см. явные ограничения задания.
const ITEMS = [
  { icon: "🎯", label: "Персональные миссии" },
  { icon: "💬", label: "AI-разговор" },
  { icon: "🧬", label: "Языковой профиль" },
];

export default function ComingSoonCard() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-3">
      <p className="text-caption mb-2">Скоро</p>
      <ul className="flex flex-col gap-1.5">
        {ITEMS.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)]"
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
