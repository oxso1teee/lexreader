import ResetRequestForm from "./reset-request-form";

export const metadata = { title: "Восстановление пароля · LexReader" };

// ?error=link — сюда возвращает /auth/callback и страница нового пароля,
// когда ссылка из письма устарела или открыта не в том браузере.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await searchParams;
  return <ResetRequestForm linkFailed={(Array.isArray(error) ? error[0] : error) === "link"} />;
}
