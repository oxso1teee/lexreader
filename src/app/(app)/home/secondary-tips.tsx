// Раздел 5 промта 2026-07-30 (композиция): второстепенные блоки (совет дня,
// апсейл премиума, приветствие новичка) — не убираем, но визуально тише,
// чем "сцена дня" выше: меньше отступов, нет тени, приглушённый фон.
export default function SecondaryTips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-2xl bg-black/[0.02] p-3 dark:bg-white/[0.02]">{children}</div>;
}
