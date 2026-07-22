import Link from "next/link";
import ResetRequestForm from "./reset-request-form";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Сброс пароля</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Введи email, привязанный к аккаунту — пришлём ссылку для сброса пароля.
        </p>
      </div>
      <ResetRequestForm />
      <Link href="/login" className="text-sm text-black/50 underline dark:text-white/50">
        ← Назад ко входу
      </Link>
    </div>
  );
}
