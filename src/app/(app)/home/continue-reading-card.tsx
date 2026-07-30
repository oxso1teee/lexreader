import Link from "next/link";

export default function ContinueReadingCard({
  textId,
  title,
  percentRead,
}: {
  textId: string;
  title: string;
  percentRead: number;
}) {
  return (
    <Link href={`/read/${textId}`} className="block rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Продолжить чтение
      </p>
      <p className="mt-1 truncate font-semibold">{title}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percentRead}%` }} />
      </div>
    </Link>
  );
}
