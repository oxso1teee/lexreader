import { ArrowLeft, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";

// Шапка плеера: выход, прогресс, возврат на шаг назад. Шкала показывает шаги,
// ПРИНЯТЫЕ сервером (сохранённый прогресс), а счётчик — шаг на экране.
export default function LessonHeader({
  subtitle,
  counter,
  ratio,
  progressLabel,
  onExit,
  onBack,
}: {
  subtitle: string;
  counter: string;
  ratio: number;
  progressLabel: string;
  onExit: () => void;
  onBack?: () => void;
}) {
  return (
    <header className="ls-top">
      <IconButton label="Выйти из урока" icon={<X aria-hidden="true" className="h-6 w-6" />} onClick={onExit} />
      <div className="ls-top-body">
        <div className="ls-meta">
          <span>{subtitle}</span>
          <span aria-hidden="true">{counter}</span>
        </div>
        <Progress value={ratio} size="lg" label={`${progressLabel}. ${counter}`} />
      </div>
      {onBack ? (
        <IconButton label="Назад к предыдущему шагу" icon={<ArrowLeft aria-hidden="true" className="h-6 w-6" />} onClick={onBack} />
      ) : (
        <span className="ls-top-spacer" aria-hidden="true" />
      )}
    </header>
  );
}
