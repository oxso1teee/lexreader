import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const profile = await getProfile();
  if (profile) {
    redirect("/library");
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Вход в LexReader</h1>
      <LoginForm />
    </div>
  );
}
