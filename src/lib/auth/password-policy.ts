import { pluralRu } from "../plural-ru.ts";

// Единая политика пароля LexReader: один модуль рисует чеклист и шкалу в
// форме и проверяет пароль на сервере (server actions) — подсказка и
// проверка не могут разойтись. Правила — из макета Reset-password-confirm
// (Ultimate Design System): не меньше 8 символов и хотя бы одна цифра;
// совпадение с повтором проверяется отдельно (validatePassword).
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt в GoTrue учитывает только первые 72 БАЙТА — длиннее пароль
// отвергается, поэтому ограничиваем явно и понятным текстом.
export const PASSWORD_MAX_BYTES = 72;
const STRONG_LENGTH = 12;

export type PasswordRuleId = "length" | "digit";

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  met: boolean;
}

/** Длина в символах (эмодзи и пары суррогатов считаются за один). */
export function passwordLength(password: string): number {
  return Array.from(password).length;
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    {
      id: "length",
      label: `Не меньше ${PASSWORD_MIN_LENGTH} символов`,
      met: passwordLength(password) >= PASSWORD_MIN_LENGTH,
    },
    { id: "digit", label: "Хотя бы одна цифра", met: /\d/.test(password) },
  ];
}

export type PasswordStrengthLevel = 0 | 1 | 2 | 3;

export interface PasswordStrength {
  /** 0 — пусто; 1 — слабый (правила не выполнены); 2 — средний; 3 — надёжный. */
  level: PasswordStrengthLevel;
  label: "" | "Слабый" | "Средний" | "Надёжный";
  /** Что сделать, чтобы стало лучше (или нейтральная подсказка для пустого поля). */
  hint: string;
}

function characterClasses(password: string): number {
  return [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\p{N}]/u].filter((re) => re.test(password)).length;
}

export function passwordStrength(password: string): PasswordStrength {
  const length = passwordLength(password);
  if (length === 0) {
    return { level: 0, label: "", hint: `Не меньше ${PASSWORD_MIN_LENGTH} символов и хотя бы одна цифра` };
  }

  const hasDigit = /\d/.test(password);
  const missing = PASSWORD_MIN_LENGTH - length;
  if (missing > 0 || !hasDigit) {
    const needs: string[] = [];
    if (missing > 0) needs.push(`ещё ${missing} ${pluralRu(missing, "символ", "символа", "символов")}`);
    if (!hasDigit) needs.push("цифру");
    return { level: 1, label: "Слабый", hint: `добавь ${needs.join(" и ")}` };
  }

  if (length >= STRONG_LENGTH || characterClasses(password) >= 3) {
    return { level: 3, label: "Надёжный", hint: "Такой пароль сложно подобрать" };
  }
  return {
    level: 2,
    label: "Средний",
    hint: `добавь заглавную букву, символ или удлини до ${STRONG_LENGTH}`,
  };
}

export type PasswordCheck = { ok: true } | { ok: false; error: string };

/** Серверная проверка. confirmation передаём, когда в форме есть «Повтори пароль». */
export function validatePassword(password: string, confirmation?: string): PasswordCheck {
  if (passwordLength(password) < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов.` };
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return { ok: false, error: "Пароль слишком длинный — не больше 72 байт (около 36 русских букв)." };
  }
  if (!/\d/.test(password)) {
    return { ok: false, error: "Добавь в пароль хотя бы одну цифру." };
  }
  if (confirmation !== undefined && password !== confirmation) {
    return { ok: false, error: "Пароли не совпадают." };
  }
  return { ok: true };
}
