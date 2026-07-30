import Link from "next/link";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

function formatPartsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} часть`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} части`;
  return `${count} частей`;
}

export default function CollectionCard({
  id,
  title,
  textCount,
  avgPercentRead,
  lastReadAt,
}: {
  id: string;
  title: string;
  textCount: number;
  avgPercentRead: number;
  lastReadAt: string | null;
}) {
  return (
    <Link
      href={`/library/collections/${id}`}
      className="block rounded-lg border border-black/10 px-4 py-3 transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
    >
      <p className="truncate font-medium">📚 {title}</p>
      <p className="text-sm text-black/50 dark:text-white/50">{formatPartsCount(textCount)}</p>
      {lastReadAt && (
        <p className="mt-0.5 text-xs text-black/40 dark:text-white/40">
          Последнее чтение: {formatDate(lastReadAt)}
        </p>
      )}
      {avgPercentRead > 0 && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${avgPercentRead}%` }}
          />
        </div>
      )}
    </Link>
  );
}
