"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Checkbox / Radio / Switch. Нативные input (checkbox, radio) — клавиатура
// и формы работают «из коробки»; зона нажатия — вся строка (≥44px).
interface ChoiceChrome {
  label: ReactNode;
  hint?: ReactNode;
  wrapperClassName?: string;
}

function Choice({
  type,
  label,
  hint,
  wrapperClassName,
  className,
  id,
  ...props
}: ChoiceChrome & { type: "checkbox" | "radio" } & Omit<ComponentProps<"input">, "type">) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label htmlFor={inputId} className={cx("choice", wrapperClassName)}>
      <input
        id={inputId}
        type={type}
        className={cx("choice-input", className)}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      <span>
        {label}
        {hint && (
          <span id={`${inputId}-hint`} className="choice-hint">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export function Checkbox(props: ChoiceChrome & Omit<ComponentProps<"input">, "type">) {
  return <Choice type="checkbox" {...props} />;
}

export function Radio(props: ChoiceChrome & Omit<ComponentProps<"input">, "type">) {
  return <Choice type="radio" {...props} />;
}

export interface RadioOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

// Группа радио: fieldset+legend (скринридер объявляет вопрос), один name,
// стрелки переключают вариант — это поведение нативного radio.
export function RadioGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
}: {
  legend: string;
  name: string;
  options: readonly RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  return (
    <fieldset className={className}>
      <legend className="field-label">{legend}</legend>
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name}
          value={o.value}
          label={o.label}
          hint={o.hint}
          disabled={o.disabled}
          checked={current === o.value}
          onChange={() => {
            setInner(o.value);
            onValueChange?.(o.value);
          }}
        />
      ))}
    </fieldset>
  );
}

// Switch: role="switch" на <button> — Space/Enter переключают нативно.
// Визуальный трек 48×28 лежит в зоне нажатия 60×44 (ui.css). name — если
// нужен в обычной <form>: добавляется скрытый input со значением "on"/"".
export function Switch({
  label,
  hint,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  name,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
}) {
  const id = useId();
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  return (
    <div className={cx("flex min-h-11 items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <span id={`${id}-label`} className="block text-base font-semibold">
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className="choice-hint">
            {hint}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        className="switch"
        onClick={() => {
          setInner(!on);
          onCheckedChange?.(!on);
        }}
      />
      {name && <input type="hidden" name={name} value={on ? "on" : ""} />}
    </div>
  );
}
