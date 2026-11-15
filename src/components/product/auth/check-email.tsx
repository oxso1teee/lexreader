"use client";

import { AtSign, ExternalLink, Mail, RefreshCw } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Alert, Button, Card, buttonClassName, toast } from "@/components/ui";
import RateLimitNotice from "@/components/rate-limit-notice";
import { Lex } from "@/components/product/mascot/lex";
import { mailProviderFor } from "@/lib/auth/email";
import type { EmailLinkAction, EmailLinkState } from "@/lib/auth/types";
import { formatCountdown } from "@/lib/rate-limit-format";
import { useCountdown } from "@/lib/ui/use-countdown";
import { AuthBody, AuthDock, AuthScreen } from "./auth-screen";

// Экран «Проверь почту» (макет Magic-link-sent): один для входа по ссылке и
// для сброса пароля — отличаются только тексты. Повторная отправка — через
// тот же server action, что и первая (его лимиты на сервере; обратный отсчёт
// здесь только подсказка, а не защита).
const RESEND_SECONDS = 60;

const COPY = {
  magic: {
    title: "Вход по ссылке",
    lead: "Если аккаунт с этим email есть, мы отправили ссылку для входа на",
    steps: [
      "Найди письмо от LexReader",
      "Нажми на ссылку для входа внутри письма",
      "Нет письма? Загляни в «Спам» и проверь, что адрес без опечаток",
    ],
    bannerTitle: "Открой ссылку в этом же браузере",
    bannerBody: "Так вход произойдёт сам — пароль не нужен.",
  },
  reset: {
    title: "Восстановление",
    lead: "Если аккаунт с этим email есть, мы отправили ссылку для нового пароля на",
    steps: [
      "Найди письмо от LexReader",
      "Нажми на ссылку для сброса пароля внутри письма",
      "Нет письма? Загляни в «Спам» и проверь, что адрес без опечаток",
    ],
    bannerTitle: "Открой ссылку в этом же браузере",
    bannerBody: "Там ты задашь новый пароль.",
  },
} as const;

export function CheckEmail({
  email,
  purpose,
  resend,
  hiddenFields,
  onChangeEmail,
}: {
  email: string;
  purpose: keyof typeof COPY;
  /** Тот же server action, что отправил первое письмо. */
  resend: EmailLinkAction;
  /** Поля, которые нужно отправить вместе с email (например next). */
  hiddenFields?: Record<string, string>;
  onChangeEmail: () => void;
}) {
  const copy = COPY[purpose];
  const provider = mailProviderFor(email);
  const { secondsLeft, restart } = useCountdown(RESEND_SECONDS);

  // Этот экран подменяет форму, на кнопке которой стоял фокус, — кнопка
  // исчезла, и клавиатура с экранным диктором оказались бы в начале страницы.
  // Переносим фокус на заголовок нового экрана.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const [state, formAction, pending] = useActionState<EmailLinkState, FormData>(async (previous, formData) => {
    const result = await resend(previous, formData);
    if (result.sent) {
      restart();
      toast.success("Письмо отправлено ещё раз");
    }
    return result;
  }, {});

  return (
    <AuthScreen title={copy.title} onBack={onChangeEmail}>
      <div className="flex flex-1 flex-col md:flex-none">
        <AuthBody>
          <div aria-hidden="true" className="relative mx-auto mt-1 h-[150px] w-[220px] flex-none">
            <div className="absolute left-[30px] top-[14px] flex h-[116px] w-[150px] -rotate-6 items-center justify-center rounded-[28px] bg-[var(--sky-fill)] text-white shadow-[inset_0_-6px_0_0_var(--sky-fill-edge)]">
              <Mail className="h-12 w-12" />
            </div>
            <span className="absolute left-[150px] top-1 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--sun)] font-display text-[15px] font-bold text-[#1a1a1a] ring-4 ring-[var(--background)]">
              1
            </span>
            <Lex mood="happy" size={88} bob className="absolute -bottom-1.5 right-0" />
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-[1.625rem] leading-tight font-bold outline-none">
              Проверь почту
            </h1>
            <p className="text-[0.9375rem] text-[var(--text-secondary)]">{copy.lead}</p>
            <span className="mt-1 inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-[0.9375rem] font-bold">
              <AtSign aria-hidden="true" className="h-[18px] w-[18px] flex-none text-[var(--sky-text)]" />
              <span className="break-all">{email}</span>
            </span>
          </div>

          <Alert tone="info" title={copy.bannerTitle}>
            {copy.bannerBody}
          </Alert>

          <Card as="section" aria-label="Что делать дальше">
            <ol className="flex flex-col gap-2.5">
              {copy.steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[var(--sky-tint)] text-[13px] font-bold text-[var(--sky-text)]"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Card>

          {state.error && !state.retryAfterSeconds && (
            <Alert tone="error" live="assertive">
              {state.error}
            </Alert>
          )}
          {state.retryAfterSeconds ? (
            <RateLimitNotice
              key={state.retryAfterSeconds}
              message={state.error ?? "Слишком много запросов."}
              retryAfterSeconds={state.retryAfterSeconds}
            />
          ) : null}
        </AuthBody>

        <AuthDock>
          {provider && (
            <a
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({ variant: "ghost", block: true })}
            >
              <ExternalLink aria-hidden="true" className="h-[18px] w-[18px]" />
              Открыть {provider.name}
              <span className="sr-only"> (откроется в новой вкладке)</span>
            </a>
          )}

          {secondsLeft > 0 ? (
            <p className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-[var(--text-tertiary)]">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              <span>
                Отправить ещё раз через <b className="font-mono">{formatCountdown(secondsLeft)}</b>
              </span>
            </p>
          ) : (
            <form action={formAction} className="flex">
              <input type="hidden" name="email" value={email} />
              {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button type="submit" variant="ghost" block loading={pending}>
                <RefreshCw aria-hidden="true" className="h-[18px] w-[18px]" />
                Отправить ещё раз
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={onChangeEmail}
            className="min-h-11 text-sm font-bold text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--foreground)]"
          >
            Ввести другой email
          </button>
        </AuthDock>
      </div>
    </AuthScreen>
  );
}
