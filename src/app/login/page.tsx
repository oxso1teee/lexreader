import { redirect } from "next/navigation";
import LoginFlow from "@/components/product/auth/login-flow";
import { getProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/safe-next";

export const metadata = { title: "Вход · LexReader" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Режим экрана задаёт URL: /login, /login?mode=signup (регистрация),
// /login?reason=expired (сессия истекла), /login?error=link (ссылка из письма
// не сработала), /login?next=/read/… (куда вернуть после входа).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));

  const profile = await getProfile();
  if (profile) {
    redirect(next ?? "/home");
  }

  return (
    <LoginFlow
      mode={first(params.mode) === "signup" ? "signup" : "signin"}
      reason={first(params.reason) === "expired" ? "expired" : null}
      linkFailed={first(params.error) === "link"}
      next={next}
    />
  );
}
