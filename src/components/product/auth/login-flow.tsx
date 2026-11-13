"use client";

import { Flame, Laptop, Layers, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { login, requestMagicLink, type LoginState } from "@/app/login/actions";
import { completeOnboarding, type OnboardingState } from "@/app/onboarding/actions";
import { Lex } from "@/components/product/mascot/lex";
import RateLimitNotice from "@/components/rate-limit-notice";
import { Alert, Button, Input } from "@/components/ui";
import type { EmailLinkState } from "@/lib/auth/types";
import { useRetryBlock } from "@/lib/ui/use-retry-block";
import { AuthBody, AuthDock, AuthScreen } from "./auth-screen";
import { CheckEmail } from "./check-email";
import { PasswordField } from "./password-field";

// /login — три состояния одного экрана (решение Phase 2 №6: без /signup):
//   signin  — Login (+ «Войти по ссылке из письма» → Magic-link-sent),
//   signup  — Signup (создаёт аккаунт тем же completeOnboarding, что и
//             онбординг-визард; язык по умолчанию — единственный готовый),
//   expired — Session-expired: тот же вход с пояснением «Войди снова».
// Режим приходит из URL (?mode=signup, ?reason=expired), поэтому ссылки на
// него работают и из писем, и из закладок.
const DEFAULT_TARGET_LANGUAGE = "en"; // READY_LANGUAGES — готов только английский
const DEFAULT_NATIVE_LANGUAGE = "ru"; // интерфейс и переводы — русские

export interface LoginFlowProps {
  mode: "signin" | "signup";
  reason: "expired" | null;
  /** Ссылка из письма не сработала (устарела / другой браузер). */
  linkFailed: boolean;
  /** Куда вернуть после входа (уже проверено safeNextPath на сервере). */
  next: string | null;
}

function AccountSwitch({ question, action, href }: { question: string; action: string; href: string }) {
  return (
    <AuthDock className="flex-row items-center justify-center gap-1.5">
      <span className="text-sm text-[var(--text-secondary)]">{question}</span>
      <Link href={href} className="-my-2 flex min-h-11 items-center px-1.5 text-[0.9375rem] font-bold text-[var(--leaf-text)] underline underline-offset-2">
        {action}
      </Link>
    </AuthDock>
  );
}

function Hero({ children, lex }: { children: ReactNode; lex: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2 text-center">
      {lex}
      {children}
    </div>
  );
}

function SigninForm({ reason, linkFailed, next }: Omit<LoginFlowProps, "mode">) {
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(login, {});
  const [magicState, magicAction, magicPending] = useActionState<EmailLinkState, FormData>(requestMagicLink, {});
  const [loginBlocked, unblockLogin] = useRetryBlock(loginState.retryAfterSeconds);
  const [magicBlocked, unblockMagic] = useRetryBlock(magicState.retryAfterSeconds);
  const [email, setEmail] = useState("");
  // «Ввести другой email» прячет экран «Проверь почту», не стирая ответ сервера.
  const [dismissed, setDismissed] = useState<EmailLinkState | null>(null);

  if (magicState.sent && magicState !== dismissed) {
    return (
      <CheckEmail
        email={magicState.email ?? email}
        purpose="magic"
        resend={requestMagicLink}
        hiddenFields={next ? { next } : undefined}
        onChangeEmail={() => setDismissed(magicState)}
      />
    );
  }

  const busy = loginPending || magicPending;
  const signupHref = next ? `/login?mode=signup&next=${encodeURIComponent(next)}` : "/login?mode=signup";

  return (
    <AuthScreen title="Вход" backHref="/onboarding">
      <form action={loginAction} className="flex flex-1 flex-col md:flex-none">
        <AuthBody>
          {reason === "expired" ? (
            <Hero
              lex={
                <span
                  aria-hidden="true"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-[var(--sky-tint)] text-[var(--sky-text)]"
                >
                  <Lock className="h-10 w-10" />
                </span>
              }
            >
              <h1 className="font-display text-[1.625rem] leading-tight font-bold">Войди снова</h1>
              <p className="text-[0.9375rem] text-[var(--text-secondary)]">
                Сессия истекла — так бывает после долгого перерыва, выхода на другом устройстве или смены пароля.
              </p>
              <Alert tone="success" title="Прогресс сохранён" className="mt-1 w-full text-left">
                Слова, стрик и чтение никуда не делись — они вернутся сразу после входа.
              </Alert>
            </Hero>
          ) : (
            <Hero lex={<Lex mood="wink" size={88} bob />}>
              <h1 className="font-display text-[1.625rem] leading-tight font-bold">С возвращением!</h1>
              <p className="text-[0.9375rem] text-[var(--text-secondary)]">
                Войди, чтобы продолжить чтение и повторять слова.
              </p>
            </Hero>
          )}

          {linkFailed && (
            <Alert tone="error" live="assertive" title="Ссылка не сработала">
              Она устарела или открыта не в том браузере, где запрошена. Запроси новую — это займёт минуту.
            </Alert>
          )}

          <input type="hidden" name="next" value={next ?? ""} />

          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
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
            error={!magicState.sent && !magicState.retryAfterSeconds ? magicState.error : undefined}
          />

          <div>
            <PasswordField
              name="password"
              autoComplete="current-password"
              required
              error={loginState.error && !loginState.retryAfterSeconds ? loginState.error : undefined}
            />
            <Link
              href="/reset-password"
              // Отдельный бакет от login (auth-rate-limit.ts) — блокировка входа
              // не должна мешать перейти к сбросу пароля.
              className="-mb-2 flex min-h-11 items-center justify-end text-[0.84rem] font-bold text-[var(--leaf-text)]"
            >
              Забыли пароль?
            </Link>
          </div>

          {loginBlocked && loginState.retryAfterSeconds ? (
            <RateLimitNotice
              key={loginState.retryAfterSeconds}
              message={loginState.error ?? "Слишком много попыток входа."}
              retryAfterSeconds={loginState.retryAfterSeconds}
              onExpire={unblockLogin}
            />
          ) : null}
          {magicBlocked && magicState.retryAfterSeconds ? (
            <RateLimitNotice
              key={magicState.retryAfterSeconds}
              message={magicState.error ?? "Слишком много запросов ссылки."}
              retryAfterSeconds={magicState.retryAfterSeconds}
              onExpire={unblockMagic}
            />
          ) : null}

          <Button type="submit" block loading={loginPending} disabled={loginBlocked || magicPending}>
            Войти
          </Button>

          <div className="flex items-center gap-3 text-xs font-semibold text-[var(--text-tertiary)] before:flex-1 before:border-t before:border-[var(--border)] before:content-[''] after:flex-1 after:border-t after:border-[var(--border)] after:content-['']">
            или
          </div>

          <Button
            type="submit"
            formAction={magicAction}
            formNoValidate
            variant="ghost"
            block
            loading={magicPending}
            disabled={magicBlocked || loginPending}
          >
            <Mail aria-hidden="true" className="h-[18px] w-[18px]" />
            Войти по ссылке из письма
          </Button>
          <p className="text-center text-xs text-[var(--text-tertiary)]">
            Без пароля: пришлём одноразовую ссылку на почту.
            {busy && <span className="sr-only"> Отправляем…</span>}
          </p>
        </AuthBody>
        <AccountSwitch question="Нет аккаунта?" action="Создать" href={signupHref} />
      </form>
    </AuthScreen>
  );
}

const PERKS = [
  { icon: Layers, label: "Карточки SRS" },
  { icon: Flame, label: "Стрик" },
  { icon: Laptop, label: "Везде" },
] as const;

function SignupForm({ next }: Pick<LoginFlowProps, "next">) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const [blocked, unblock] = useRetryBlock(state.retryAfterSeconds);
  const [email, setEmail] = useState("");
  const signinHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <AuthScreen title="Регистрация" subtitle="бесплатно · 1 минута" backHref="/onboarding">
      <form action={formAction} className="flex flex-1 flex-col md:flex-none">
        <AuthBody>
          <section className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[1.375rem] leading-tight font-bold">Создай аккаунт</h1>
              <p className="mt-1.5 text-[0.9375rem] text-[var(--text-secondary)]">
                Слова, стрик и прогресс чтения будут с тобой на всех устройствах.
              </p>
            </div>
            <Lex mood="joy" size={56} bob />
          </section>

          <ul className="flex flex-wrap gap-2">
            {PERKS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--leaf-tint)] px-2.5 py-1.5 text-[0.78rem] font-semibold text-[var(--leaf-text)]"
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                {label}
              </li>
            ))}
          </ul>

          <input type="hidden" name="targetLanguage" value={DEFAULT_TARGET_LANGUAGE} />
          <input type="hidden" name="nativeLanguage" value={DEFAULT_NATIVE_LANGUAGE} />

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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            icon={<Mail />}
          />
          <PasswordField name="password" autoComplete="new-password" required meter />

          {state.error && !blocked && (
            <Alert tone="error" live="assertive">
              {state.error}
            </Alert>
          )}
          {blocked && state.retryAfterSeconds ? (
            <RateLimitNotice
              key={state.retryAfterSeconds}
              message={state.error ?? "Слишком много попыток регистрации."}
              retryAfterSeconds={state.retryAfterSeconds}
              onExpire={unblock}
            />
          ) : null}

          <Button type="submit" block loading={pending} disabled={blocked} className="mt-0.5">
            Создать аккаунт
          </Button>
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Нажимая «Создать аккаунт», ты принимаешь{" "}
            <Link href="/terms" className="underline underline-offset-2">
              Условия использования
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Политику конфиденциальности
            </Link>
          </p>
        </AuthBody>
        <AccountSwitch question="Уже есть аккаунт?" action="Войти" href={signinHref} />
      </form>
    </AuthScreen>
  );
}

export default function LoginFlow({ mode, ...rest }: LoginFlowProps) {
  return mode === "signup" ? <SignupForm next={rest.next} /> : <SigninForm {...rest} />;
}
