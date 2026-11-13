"use client";

import { Info, KeyRound, Mail, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { AuthBody, AuthDock, AuthScreen } from "@/components/product/auth/auth-screen";
import { CheckEmail } from "@/components/product/auth/check-email";
import { Lex } from "@/components/product/mascot/lex";
import RateLimitNotice from "@/components/rate-limit-notice";
import { Alert, Button, Card, Input } from "@/components/ui";
import { useRetryBlock } from "@/lib/ui/use-retry-block";
import { requestPasswordReset, type ResetRequestState } from "./actions";

// Reset-password (макет): запрос ссылки для нового пароля. После отправки —
// тот же экран «Проверь почту», что и у входа по ссылке (CheckEmail).
export default function ResetRequestForm({ linkFailed }: { linkFailed: boolean }) {
  const [state, formAction, pending] = useActionState<ResetRequestState, FormData>(requestPasswordReset, {});
  const [blocked, unblock] = useRetryBlock(state.retryAfterSeconds);
  const [email, setEmail] = useState("");
  // «Ввести другой email» прячет экран «Проверь почту», не стирая ответ сервера.
  const [dismissed, setDismissed] = useState<ResetRequestState | null>(null);

  if (state.sent && state !== dismissed) {
    return (
      <CheckEmail
        email={state.email ?? email}
        purpose="reset"
        resend={requestPasswordReset}
        onChangeEmail={() => setDismissed(state)}
      />
    );
  }

  return (
    <AuthScreen title="Восстановление" backHref="/login">
      <form action={formAction} className="flex flex-1 flex-col md:flex-none">
        <AuthBody>
          <div aria-hidden="true" className="relative mx-auto h-[148px] w-[200px] flex-none">
            <span className="absolute left-[34px] top-[18px] flex h-[112px] w-[112px] -rotate-[8deg] items-center justify-center rounded-[32px] bg-[var(--sun)] text-[#1a1a1a] shadow-[inset_0_-6px_0_0_var(--sun-edge)]">
              <KeyRound className="h-12 w-12" />
            </span>
            <Lex mood="think" size={88} bob className="absolute bottom-0 right-0" />
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-display text-[1.625rem] leading-tight font-bold">Забыл пароль?</h1>
            <p className="text-[0.9375rem] text-[var(--text-secondary)]">
              Бывает. Укажи почту, с которой регистрировался, — пришлём ссылку для нового пароля.
            </p>
          </div>

          {linkFailed && (
            <Alert tone="error" live="assertive" title="Ссылка не сработала">
              Она устарела или открыта не в том браузере, где запрошена. Запроси новую — это займёт минуту.
            </Alert>
          )}

          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            requiredMark={false}
            // После «Ввести другой email» форма появляется заново — ставим курсор в поле.
            autoFocus={dismissed !== null}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            icon={<Mail />}
            hint="Пришлём ссылку, если аккаунт с таким email есть"
            error={!blocked ? state.error : undefined}
          />

          {blocked && state.retryAfterSeconds ? (
            <RateLimitNotice
              key={state.retryAfterSeconds}
              message={state.error ?? "Слишком много запросов на сброс пароля."}
              retryAfterSeconds={state.retryAfterSeconds}
              onExpire={unblock}
            />
          ) : null}

          <Card as="section" tone="sunken" className="flex flex-col gap-2">
            <div className="flex items-start gap-3 text-sm">
              <ShieldCheck aria-hidden="true" className="mt-px h-[18px] w-[18px] flex-none text-[var(--leaf-text)]" />
              <p>Прогресс, стрик и слова никуда не денутся — меняется только пароль.</p>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <Info aria-hidden="true" className="mt-px h-[18px] w-[18px] flex-none text-[var(--sky-text)]" />
              <p>
                Не хочешь новый пароль? Можно{" "}
                <Link href="/login" className="font-bold underline underline-offset-2">
                  войти по ссылке из письма
                </Link>
                .
              </p>
            </div>
          </Card>
        </AuthBody>

        <AuthDock>
          <Button type="submit" block loading={pending} disabled={blocked}>
            <Send aria-hidden="true" className="h-[18px] w-[18px]" />
            Отправить ссылку
          </Button>
          <Link
            href="/login"
            className="flex min-h-11 items-center justify-center text-sm font-bold text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--foreground)]"
          >
            Вспомнил пароль
          </Link>
        </AuthDock>
      </form>
    </AuthScreen>
  );
}
