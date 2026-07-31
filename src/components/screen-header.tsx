export default function ScreenHeader({
  icon,
  title,
  metaChip,
}: {
  icon: string;
  title: string;
  metaChip?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-xl font-bold">
        <span>{icon}</span>
        <span>{title}</span>
      </span>
      {metaChip && (
        <span className="rounded-lg border border-black/20 px-2.5 py-1 text-sm font-medium dark:border-white/25">
          {metaChip}
        </span>
      )}
    </div>
  );
}
