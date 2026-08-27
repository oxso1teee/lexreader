export default function ProgressBar({
  ratio,
  label,
}: {
  /** 0..1 */
  ratio: number;
  label?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]"
    >
      <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}
