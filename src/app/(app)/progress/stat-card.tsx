// docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, раздел 4.9: убран
// параметр color с палитрой orange/green/purple/blue/red — тот же
// антипаттерн "конкурирующих акцентов", что был на старой Главной, только
// перенесённый на экран статистики. Число — просто нейтральный foreground.
export default function StatCard({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-4 shadow-sm">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-black/50 dark:text-white/50">{label}</p>
    </div>
  );
}
