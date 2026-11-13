import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Lex, type LexMood } from "@/components/product/mascot/lex";
import { IconButton, Progress, type ProgressTone } from "@/components/ui";
import { cx } from "@/lib/ui/cx";

// Каркас шага онбординга и теста уровня (макеты Onboarding-why и
// Placement-question: .lessonbar) — кнопка «назад», полоса прогресса с
// доступным именем и счётчик «1/5». Колонка одна на всех ширинах (в макетах
// для этих экранов нет desktop-композиции): 28rem по центру, как у экранов
// входа; на md+ блок центрируется по вертикали.
//
// Тело и закреплённый «док» главного действия — AuthBody / AuthDock из
// product/auth/auth-screen (те же отступы и поведение, второй копии нет).
//
// Пример:
//   <StepShell step={2} total={5} onBack={() => setStep(1)}>
//     <AuthBody><LexSay mood="wink" heading="Какой язык учишь?" />…</AuthBody>
//     <AuthDock><Button block>Далее</Button></AuthDock>
//   </StepShell>
export function StepShell({
  step,
  total,
  label,
  tone = "leaf",
  onBack,
  backLabel = "Назад",
  children,
}: {
  step: number;
  total: number;
  /** Доступное имя полосы; по умолчанию «Шаг N из M». */
  label?: string;
  tone?: ProgressTone;
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <StepFrame>
      <header className="flex flex-none items-center gap-2.5 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {onBack ? (
          <IconButton label={backLabel} icon={<ArrowLeft className="h-6 w-6" />} onClick={onBack} />
        ) : (
          <span aria-hidden="true" className="w-2 flex-none" />
        )}
        <Progress
          value={step / total}
          tone={tone}
          size="lg"
          label={label ?? `Шаг ${step} из ${total}`}
          className="min-w-0 flex-1"
        />
        <span aria-hidden="true" className="min-w-10 flex-none pr-2 text-right text-sm font-bold text-[var(--text-tertiary)]">
          {step}/{total}
        </span>
      </header>
      <main className="flex flex-1 flex-col md:flex-none">{children}</main>
    </StepFrame>
  );
}

// Внешняя рамка шага без шапки — для вводных экранов (тест уровня: «Начать
// проверку»), где полосе прогресса ещё нечего показывать. Внутрь кладут <main>.
export function StepFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col md:justify-center md:py-8">{children}</div>
  );
}

// Lex со «словами» в пузыре (макеты: .say). heading — вопрос шага (это h1
// страницы, на экране он один), children — пояснение под ним; без heading
// пузырь — просто реплика (тест уровня).
export function LexSay({
  mood,
  heading,
  children,
  className,
}: {
  mood: LexMood;
  heading?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <Lex mood={mood} size={56} className="mt-1 flex-none" />
      <div className="relative min-w-0 flex-1 rounded-[18px] border-2 border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-3">
        <span
          aria-hidden="true"
          className="absolute -left-[9px] top-[22px] h-3.5 w-3.5 rotate-45 border-b-2 border-l-2 border-[var(--border-strong)] bg-[var(--surface)]"
        />
        {heading ? (
          <>
            <h1 className="font-display text-[1.0625rem] leading-tight font-bold">{heading}</h1>
            {children ? (
              <p className="mt-1 text-[0.8125rem] leading-snug font-medium text-[var(--text-secondary)]">{children}</p>
            ) : null}
          </>
        ) : (
          <p className="text-[0.9375rem] leading-snug font-semibold">{children}</p>
        )}
      </div>
    </div>
  );
}
