"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { AuthBody, AuthDock, AuthScreen } from "@/components/product/auth/auth-screen";
import { PasswordField } from "@/components/product/auth/password-field";
import { PasswordRequirements } from "@/components/product/auth/password-meter";
import { Lex } from "@/components/product/mascot/lex";
import { Alert, Button, toast } from "@/components/ui";
import { setNewPassword, type SetPasswordState } from "./actions";

// Reset-password-confirm (макет): новый пароль со шкалой надёжности и
// чеклистом требований. Сессия восстановления уже открыта ссылкой из письма,
// поэтому после сохранения человек остаётся в аккаунте — ведём на главную.
export default function SetPasswordForm({ maskedEmail }: { maskedEmail: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(async (previous, formData) => {
    const result = await setNewPassword(previous, formData);
    if (result.success) {
      toast.success("Пароль обновлён", { description: "На других устройствах вход отменён." });
      router.replace("/home");
    }
    return result;
  }, {});

  return (
    <AuthScreen
      title="Новый пароль"
      backHref="/home"
      backLabel="Закрыть"
      backIcon={<X className="h-6 w-6" />}
    >
      <form action={formAction} className="flex flex-1 flex-col md:flex-none">
        <AuthBody>
          <Alert tone="success" title="Ссылка подтверждена">
            {maskedEmail ? `Аккаунт ${maskedEmail}` : "Задай новый пароль для входа"}
          </Alert>

          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[1.375rem] leading-tight font-bold">Придумай новый пароль</h1>
              <p className="mt-1.5 text-[0.9375rem] text-[var(--text-secondary)]">
                После сохранения ты останешься в аккаунте — вернём тебя на главную.
              </p>
            </div>
            <Lex mood="cool" size={56} />
          </div>

          <PasswordField
            name="password"
            label="Новый пароль"
            autoComplete="new-password"
            required
            meter
            onValueChange={setPassword}
          />
          <PasswordField
            name="confirmPassword"
            label="Повтори пароль"
            autoComplete="new-password"
            required
            onValueChange={setConfirmation}
          />

          <PasswordRequirements password={password} confirmation={confirmation} />

          {state.error && (
            <Alert tone="error" live="assertive">
              {state.error}
            </Alert>
          )}
        </AuthBody>

        <AuthDock>
          <Button type="submit" block loading={pending || Boolean(state.success)}>
            Сохранить и войти
          </Button>
          <p className="text-center text-xs text-[var(--text-tertiary)]">Выйдем из аккаунта на остальных устройствах</p>
        </AuthDock>
      </form>
    </AuthScreen>
  );
}
