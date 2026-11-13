"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { IconButton, Input } from "@/components/ui";
import { PasswordStrengthMeter } from "./password-meter";

// Поле пароля: кнопка «Показать/Скрыть» и (по желанию) шкала надёжности.
// Поле УПРАВЛЯЕМОЕ — React 19 сбрасывает неуправляемые поля формы после
// каждого server action, и после неудачной попытки человеку пришлось бы
// печатать пароль заново; значение лежит в state (его же читает шкала).
//
// Пример:
//   <PasswordField name="password" autoComplete="current-password" />
//   <PasswordField name="password" label="Новый пароль" autoComplete="new-password" meter onValueChange={setPassword} />
export function PasswordField({
  label = "Пароль",
  error,
  hint,
  meter = false,
  onValueChange,
  onChange,
  ...props
}: {
  label?: string;
  error?: ReactNode;
  hint?: ReactNode;
  /** Шкала надёжности под полем (регистрация, новый пароль). */
  meter?: boolean;
  onValueChange?: (value: string) => void;
} & Omit<ComponentProps<"input">, "type" | "value" | "defaultValue">) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const meterId = useId();

  return (
    <div>
      <Input
        {...props}
        requiredMark={false}
        label={label}
        type={visible ? "text" : "password"}
        value={value}
        error={error}
        hint={meter ? undefined : hint}
        icon={<Lock />}
        adornment={
          <IconButton
            label={visible ? "Скрыть пароль" : "Показать пароль"}
            icon={visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            onClick={() => setVisible((v) => !v)}
          />
        }
        aria-describedby={meter ? meterId : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          onValueChange?.(event.target.value);
          onChange?.(event);
        }}
      />
      {meter && <PasswordStrengthMeter id={meterId} password={value} />}
    </div>
  );
}
