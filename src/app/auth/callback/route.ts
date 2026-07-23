import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";

// Обмен PKCE-кода из письма (сброс пароля, будущий OAuth) на сессию —
// стандартный паттерн @supabase/ssr.
//
// НАЙДЕННЫЙ БАГ (не связан с текущей задачей, но реальный): редирект строился
// из origin, вычисленного через new URL(request.url).origin — это давало
// "localhost" в одних случаях и "127.0.0.1" в других в зависимости от того,
// как браузер попал на этот роут (напрямую vs через редирект GoTrue).
// Cookie сессии при этом уходила на ОДИН host, а браузер после редиректа
// оказывался на ДРУГОМ — сессия просто не была видна на следующей странице,
// и пользователя тихо возвращало на /reset-password, будто ссылка сброса
// пароля не сработала (без единой видимой ошибки где-либо). Подтверждено
// направленной ручной проверкой всей цепочки через Mailpit + реальную
// ссылку, не только косвенно через e2e-тест. Фикс — строить редирект через
// тот же siteUrl(), которым уже пользуются письма сброса пароля и Stripe
// (см. P0-АУДИТ 3.23), а не через host запроса.
// P0-АУДИТ (раздел 5): next приходил из query-параметра без проверки — хотя
// ${siteUrl()}${next} и так не даёт увести на чужой хост в обычном случае,
// allow-list — простая защита в глубину от абсолютных/protocol-relative
// значений next (например next=//evil.com).
const ALLOWED_NEXT_PATHS = ["/home", "/reset-password/confirm"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/home";
  const next = ALLOWED_NEXT_PATHS.includes(rawNext) ? rawNext : "/home";

  const response = NextResponse.redirect(`${siteUrl()}${next}`);

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      },
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
