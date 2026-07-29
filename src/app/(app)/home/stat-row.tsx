export default function StatRow({
  streak,
  dueCount,
  newWordsToday,
}: {
  streak: number;
  dueCount: number;
  newWordsToday: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-4 text-sm shadow-sm">
      <span>🔥 {streak} дней</span>
      <span>📇 {dueCount} к повтору</span>
      <span>＋{newWordsToday} новых</span>
    </div>
  );
}
