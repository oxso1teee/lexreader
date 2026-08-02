# PR #11 — hosted Vercel Preview verification log

Three real bugs were found and fixed by testing this branch on an actual hosted Vercel Preview deployment (not just `next dev` locally) — none were caused by the App Shell/Today UI code itself, but they blocked verifying it end-to-end on Preview. Documented here for the record and for anyone re-running this process on a future PR.

## Round 1 — every route crashed (`/`, `/login`, `/home`, ...)

- **Symptom**: hosted Preview showed the generic error boundary on every page.
- **Root cause**: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` were scoped to Production only in Vercel — every Preview deployment for this project (any branch) has always been missing them.
- **Fix**: no code change. The 3 variables' existing Production values were scoped to also include Preview via the Vercel dashboard (Project → Settings → Environment Variables → Edit → check "Preview"). Values were never viewed, copied, or retyped by the assistant.
- **Verified via**: `vercel logs` runtime error (`Error: Your project's URL and Key are required...` / `Error: supabaseKey is required.`), traced to `src/lib/supabase/server.ts` and `src/lib/supabase/service.ts`.

## Round 2 — password-reset request crashed

- **Symptom**: onboarding/login worked after round 1's fix, but requesting a password reset still hit the error boundary.
- **Root cause**: `src/lib/site-url.ts`'s `siteUrl()` intentionally throws when `NEXT_PUBLIC_SITE_URL` is unset and `NODE_ENV==="production"` — true on every Vercel Preview deployment too, not just a misconfigured Production. Used to build the reset-password email link and the `/auth/callback` redirect.
- **Fix (code, commit `28de3a3`)**: `siteUrl()` now falls back to `https://${VERCEL_URL}` (a Vercel-injected system variable, present on every deployment with zero configuration) when `NEXT_PUBLIC_SITE_URL` is absent, before falling through to the original throw-in-production / localhost-in-dev behavior. Production is unaffected — its explicit `NEXT_PUBLIC_SITE_URL` still wins unconditionally.
- **Tests added**: `src/lib/site-url.test.ts` (6 cases covering the full priority order).

## Round 3 — auth rate limiter locked out manual QA

- **Symptom**: after a normal mix of login attempts and a password-reset request, both login and reset got blocked with "Слишком много попыток входа," no indication of how long to wait.
- **Root cause**: `login`, `signup`, and `reset-password` all shared one identifier-keyed bucket in the `auth_attempts` table (email/IP with no action discriminator) — failed logins and reset requests silently consumed each other's allowance. `isAuthAttemptAllowed()` also only returned a boolean, so the UI had no wait time to display.
- **Fix (code, commit `045095f`)**: `identifier` values are now namespaced by action (`login:email`, `signup:email`, `reset-password:email`) — no schema change, since `identifier` was always a plain text column. `isAuthAttemptAllowed()` now returns `{allowed, retryAfterSeconds}`. New `RateLimitNotice` component shows a live, accessible countdown and disables submit for its duration, wired into login/signup/reset-password forms.
- **Tests added**: `src/lib/auth-rate-limit.test.ts` (bucket-separation + env-override safety, 6 cases), `src/lib/rate-limit-format.test.ts` (3 cases), plus one new e2e regression in `e2e/auth.spec.ts`.

## Final hosted verification (user-performed, this deployment: `dpl_F6tDNXUgGBPaS9H8vUdQXTwWcSbG`)

Confirmed working end-to-end on the actual hosted Preview: normal login; wrong-password → rate limit with visible countdown and disabled submit button, no error boundary; password-reset request succeeding independently of the login lockout; reset email delivered; new password set; login with the new password succeeding after cooldown. `vercel logs --level error` returned zero entries for the full session.

## Not touched, at any point in this process

Production environment variables/values, Production deployment, Supabase schema, FSRS environment variables/flags, and the PR's draft/merge state.
