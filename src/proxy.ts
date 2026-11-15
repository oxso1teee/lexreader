import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_HINT_COOKIE, SESSION_HINT_OPTIONS } from "./lib/auth/session-hint";

export async function proxy(request: NextRequest) {
  // M3 Slice 9 — forwards the requested pathname so the (app) layout can
  // gate onboarding without re-reading it from a redirect-unsafe source;
  // kept content-free otherwise (no auth/redirect decisions here, which
  // would hijack Server Action responses that also pass through here).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session cookie if expired — required for Server Components,
  // which cannot write cookies themselves.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // «Здесь уже входили» (lib/auth/session-hint.ts): по этой куке requireProfile
  // отличает вернувшегося с истёкшей сессией от нового посетителя. Только
  // GET-навигации: выход — POST и сам стирает куку, перезапись в том же ответе
  // оставила бы подсказку у вышедшего человека.
  if (user && request.method === "GET" && !request.cookies.has(SESSION_HINT_COOKIE)) {
    response.cookies.set(SESSION_HINT_COOKIE, "1", {
      ...SESSION_HINT_OPTIONS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
