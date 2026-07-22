import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SetPasswordForm from "./set-password-form";

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
