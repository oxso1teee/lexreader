"use client";

import { Check } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Карточки выбора (макеты онбординга и теста уровня, .opt): НАТИВНЫЕ радио в
// карточках. fieldset+legend объявляет вопрос, стрелки переключают вариант
// (поведение нативного radio), имя карточки — только её подпись, а описание
// подключено через aria-describedby, поэтому getByRole("radio", { name }) и
// скринридер видят короткое имя. Невидимый input лежит поверх карточки: клик
// попадает прямо в него.
//
// numbered — цифры на карточках работают ещё и как клавиши 1…9, но только пока
// фокус внутри группы (WCAG 2.1.4: одиночные клавиши допустимы лишь в
// сфокусированном компоненте).
//
// Пример:
//   <ChoiceGroup legend="Для чего тебе английский?" name="goal" value={goal} onValueChange={setGoal}
//     options={[{ value: "travel", label: "Путешествия", description: "Отели, кафе, дорога", icon: <Compass />, tone: "sun" }]} />
export type ChoiceTone = "neutral" | "leaf" | "sky" | "sun" | "ember" | "danger";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  /** Иконка в цветной плитке слева (декоративная). */
  icon?: ReactNode;
  tone?: ChoiceTone;
  disabled?: boolean;
}

export function ChoiceCard({
  name,
  value,
  label,
  description,
  icon,
  tone = "neutral",
  keyHint,
  checked,
  disabled,
  onChange,
  className,
}: {
  name: string;
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  tone?: ChoiceTone;
  /** Номер клавиши на карточке («1»); сам по себе ничего не делает — клавиши обрабатывает ChoiceGroup. */
  keyHint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  return (
    <label className={cx("choice-card", className)}>
      <input
        type="radio"
        className="choice-card-input"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
      />
      {icon ? (
        <span aria-hidden="true" className={cx("choice-card-swatch", tone !== "neutral" && `choice-swatch-${tone}`)}>
          {icon}
        </span>
      ) : null}
      {keyHint ? (
        <span aria-hidden="true" className="choice-card-key">
          {keyHint}
        </span>
      ) : null}
      <span className="choice-card-body">
        <span id={labelId} className="choice-card-label">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="choice-card-desc">
            {description}
          </span>
        ) : null}
      </span>
      <Check aria-hidden="true" className="choice-card-check" />
    </label>
  );
}

export function ChoiceGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  numbered = false,
  columns = 1,
  className,
}: {
  /** Вопрос группы — объявляется скринридером, визуально скрыт (вопрос обычно уже на экране). */
  legend: string;
  name: string;
  options: readonly ChoiceOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  numbered?: boolean;
  columns?: 1 | 2;
  className?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const group = useRef<HTMLFieldSetElement>(null);

  function select(next: string) {
    setInner(next);
    onValueChange?.(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLFieldSetElement>) {
    if (!numbered || event.altKey || event.ctrlKey || event.metaKey || !/^[1-9]$/.test(event.key)) return;
    const index = Number(event.key) - 1;
    const option = options[index];
    if (!option || option.disabled) return;
    event.preventDefault();
    select(option.value);
    group.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[index]?.focus();
  }

  return (
    <fieldset
      ref={group}
      className={cx("choice-group", columns === 2 && "choice-group-2", className)}
      onKeyDown={onKeyDown}
    >
      <legend className="sr-only">{legend}</legend>
      {options.map((option, index) => (
        <ChoiceCard
          key={option.value}
          name={name}
          value={option.value}
          label={option.label}
          description={option.description}
          icon={option.icon}
          tone={option.tone}
          keyHint={numbered ? String(index + 1) : undefined}
          checked={current === option.value}
          disabled={option.disabled}
          onChange={select}
        />
      ))}
    </fieldset>
  );
}
