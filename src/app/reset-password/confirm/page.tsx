import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { maskEmail } from "@/lib/auth/email";
import SetPasswordForm from "./set-password-form";

export const metadata = { title: "Новый пароль · LexReader" };

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
    // Зашли напрямую, без ссылки из письма (или сессия уже закончилась):
    // раньше это молча бросало на форму запроса — теперь объясняем.
    redirect("/reset-password?error=link");
  }

  return <SetPasswordForm maskedEmail={user.email ? maskEmail(user.email) : null} />;
}
