// Disabled/coming-soon entry points — визуально второстепенные, явно
// помечены "Скоро", не кликабельны (никакой fake-функциональности за
// ними). Не Missions engine, не AI Platform — см. явные ограничения задания.
// M3 Slice 5: "Языковой профиль" убран отсюда — это было место-держатель
// для Language Twin, который теперь реально реализован и живёт в
// /language-twin (см. LanguageTwinSummaryCard на этой же странице).
const ITEMS = [
  { icon: "🎯", label: "Персональные миссии" },
  { icon: "💬", label: "AI-разговор" },
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
