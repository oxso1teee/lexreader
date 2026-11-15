import ContinueLearningCard from "@/components/product/today/continue-learning-card";
import { CardLink } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface PathCardData {
  href: string;
  /** «B1 → B2». */
  label: string;
  /** Название навыка, на котором путь сейчас сфокусирован. */
  title: string;
  /** Готовность курса, 0..100. */
  percent: number;
}

// «Продолжить»: последний начатый материал (text_progress) и учебный путь.
// Пустое состояние материала рисует сама ContinueLearningCard; для пути —
// приглашение выбрать его (маршрут /learning-paths показывает каталог, пока
// путь не выбран, и сразу открывает карту, когда выбран).
export default function ContinueSection({
  reading,
  isVideo,
  showReading = true,
  path,
  showPathInvite,
  lastActivity,
}: {
  reading: { textId: string; title: string; percentRead: number } | null;
  isVideo: boolean;
  /** false — материал уже показан в «Хочешь ещё?», карточку не дублируем. */
  showReading?: boolean;
  path: PathCardData | null;
  showPathInvite: boolean;
  lastActivity: string | null;
}) {
  if (!showReading && !path && !showPathInvite) return null;
  const percent = path ? Math.min(100, Math.max(0, Math.round(path.percent))) : 0;
  return (
    <section aria-labelledby="dash-continue-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="dash-continue-title"
          className="m-0 text-xs font-bold tracking-[0.06em] text-[var(--text-secondary)] uppercase"
        >
          Продолжить
        </h2>
        {lastActivity && <span className="text-xs text-[var(--text-secondary)]">Последнее занятие: {lastActivity}</span>}
      </div>

      {showReading && <ContinueLearningCard material={reading} isVideo={isVideo} />}

      {path ? (
        <CardLink href={path.href} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-xs text-[var(--text-secondary)]">Мой путь · {path.label}</p>
              <p className="m-0 truncate text-sm font-bold">{path.title}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[var(--color-forest-text)]">Продолжить →</span>
          </div>
          <Progress value={percent / 100} size="sm" label={`Прогресс пути: ${percent}%`} />
        </CardLink>
      ) : showPathInvite ? (
        <CardLink href="/learning-paths" dashed className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-sm font-bold">Учебный путь</p>
            <p className="m-0 text-xs text-[var(--text-secondary)]">Пошаговая программа обучения</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-[var(--color-forest-text)]">Выбрать →</span>
        </CardLink>
      ) : null}
    </section>
  );
}
