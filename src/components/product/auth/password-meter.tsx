import { Check, Minus } from "lucide-react";
import { Card } from "@/components/ui";
import { passwordRules, passwordStrength, type PasswordStrengthLevel } from "@/lib/auth/password-policy";
import { cx } from "@/lib/ui/cx";

// Подсказки к паролю по макетам Signup (шкала) и Reset-password-confirm
// (шкала + чеклист требований). Правила и текст берутся из
// lib/auth/password-policy.ts — тот же модуль проверяет пароль на сервере.
const BAR_TONE: Record<PasswordStrengthLevel, string> = {
  0: "",
  1: "bg-[var(--danger)]",
  2: "bg-[var(--sun)]",
  3: "bg-[var(--leaf)]",
};

const TEXT_TONE: Record<PasswordStrengthLevel, string> = {
  0: "text-[var(--text-secondary)]",
  1: "text-[var(--danger-text)]",
  2: "text-[var(--sun-text)]",
  3: "text-[var(--leaf-text)]",
};

export function PasswordStrengthMeter({ id, password }: { id?: string; password: string }) {
  const strength = passwordStrength(password);
  const text = strength.level === 1 || strength.level === 2 ? `${strength.label} — ${strength.hint}` : strength.hint;

  return (
    <div id={id} className="mt-2">
      <div className="flex items-center gap-2">
        <div
          role="img"
          aria-label={
            strength.level ? `Надёжность пароля: ${strength.label.toLowerCase()}` : "Надёжность пароля: пароль пока не введён"
          }
          className="grid flex-1 grid-cols-3 gap-1"
        >
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={cx(
                "h-1.5 rounded-sm bg-[var(--border-strong)] transition-colors",
                step <= strength.level && BAR_TONE[strength.level],
              )}
            />
          ))}
        </div>
        {strength.level > 0 && (
          <span className={cx("text-xs font-bold", TEXT_TONE[strength.level])}>{strength.level} из 3</span>
        )}
      </div>
      <p aria-live="polite" className={cx("mt-1 text-[0.8125rem] leading-snug", TEXT_TONE[strength.level])}>
        {text}
      </p>
    </div>
  );
}

export function PasswordRequirements({ password, confirmation }: { password: string; confirmation: string }) {
  const matches = password.length > 0 && confirmation === password;
  const items = [
    ...passwordRules(password).map((rule) => ({ id: rule.id, label: rule.label, met: rule.met })),
    {
      id: "match",
      label: matches
        ? "Пароли совпадают"
        : confirmation.length > 0
          ? "Пароли пока не совпадают"
          : "Пароли совпадают — повтори пароль во втором поле",
      met: matches,
    },
  ];

  return (
    <Card as="section" aria-label="Требования к паролю" className="flex flex-col gap-1">
      <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Требования</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            className={cx(
              "flex min-h-7 items-center gap-2.5 text-[0.84rem] font-semibold leading-snug",
              !item.met && "text-[var(--text-secondary)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full",
                item.met
                  ? "bg-[var(--leaf-tint)] text-[var(--leaf-text)]"
                  : "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
              )}
            >
              {item.met ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </span>
            <span>
              <span className="sr-only">{item.met ? "Выполнено: " : "Не выполнено: "}</span>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
