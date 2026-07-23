import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SetPasswordForm from "./set-password-form";

// P0-АУДИТ (раздел 4, M7): пробовал ужесточить проверку до "именно сессия
// восстановления пароля" через amr-claim JWT (amr: [{method: "recovery"}]) —
// подтвердил вручную, что claim реально приходит от GoTrue. Но
// supabase.auth.getSession() в этом Server Component надёжно возвращал null
// даже при валидной recovery-сессии в куках (проверено напрямую через
// Mailpit + реальную ссылку сброса) — в отличие от getUser(), которым и
// пользуется getSessionUser() ниже. Не стал держать это в проде: сломало бы
// сброс пароля для всех ради узкого edge-кейса (чужое устройство). Оставляю
// как есть — не самая критичная дыра из аудита, дальше можно докрутить
// через ручной разбор сырой cookie, если найдётся время.
export default async function ResetPasswordConfirmPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/reset-password");
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Новый пароль</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Придумай новый пароль для входа в LexReader.
        </p>
      </div>
      <SetPasswordForm />
    </div>
  );
}
