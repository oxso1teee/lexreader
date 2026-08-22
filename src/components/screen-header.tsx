import type { LucideIcon } from "lucide-react";

// Раздел B.3 файла 10 (единая иконочная система) — заголовок экрана
// функциональный (не тёплый/человечный контекст вроде EmptyState),
// раньше icon был эмодзи-строкой.
export default function ScreenHeader({
  icon: Icon,
  title,
  metaChip,
}: {
  icon: LucideIcon;
  title: string;
  metaChip?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-xl font-bold">
        <Icon aria-hidden="true" className="h-5 w-5" />
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
