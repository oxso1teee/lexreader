import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Поля формы. Label/hint/error подключаются сами: label ↔ for/id, hint и
// error ↔ aria-describedby, error ↔ aria-invalid. Без label компонент
// требует aria-label от вызывающего (иначе у поля нет имени).
interface FieldChrome {
  label?: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** className обёртки (сама рамка поля — через className). */
  wrapperClassName?: string;
}

function useFieldIds(id: string | undefined) {
  const generated = useId();
  const fieldId = id ?? generated;
  return { fieldId, hintId: `${fieldId}-hint`, errorId: `${fieldId}-error` };
}

function describedBy(ids: { hintId: string; errorId: string }, hint: ReactNode, error: ReactNode, extra?: string) {
  return cx(extra, error ? ids.errorId : false, hint ? ids.hintId : false) || undefined;
}

function FieldShell({
  ids,
  label,
  hint,
  error,
  required,
  wrapperClassName,
  children,
}: FieldChrome & { ids: { fieldId: string; hintId: string; errorId: string }; required?: boolean; children: ReactNode }) {
  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={ids.fieldId} className="field-label">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={ids.errorId} className="field-hint field-hint-error" aria-live="polite">
          {error}
        </p>
      ) : hint ? (
        <p id={ids.hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ label, hint, error, wrapperClassName, className, id, required, ...props }: FieldChrome & ComponentProps<"input">) {
  const ids = useFieldIds(id);
  return (
    <FieldShell ids={ids} label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <input
        id={ids.fieldId}
        className={cx("field-control", className)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error, props["aria-describedby"])}
        {...props}
      />
    </FieldShell>
  );
}

export function Textarea({ label, hint, error, wrapperClassName, className, id, required, ...props }: FieldChrome & ComponentProps<"textarea">) {
  const ids = useFieldIds(id);
  return (
    <FieldShell ids={ids} label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <textarea
        id={ids.fieldId}
        className={cx("field-control", className)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error, props["aria-describedby"])}
        {...props}
      />
    </FieldShell>
  );
}

// Нативный <select>: на мобильных открывает системный пикер (лучшая
// доступность и привычный UX), стилизуется только закрытое состояние.
export function Select({ label, hint, error, wrapperClassName, className, id, required, children, ...props }: FieldChrome & ComponentProps<"select">) {
  const ids = useFieldIds(id);
  return (
    <FieldShell ids={ids} label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <select
        id={ids.fieldId}
        className={cx("field-control", className)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error, props["aria-describedby"])}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
