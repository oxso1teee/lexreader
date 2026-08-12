import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/subscription";
import { resolveOnboardingUrl } from "@/lib/onboarding/resolve";
import PostHogProvider from "../posthog-provider";
import AppShell from "@/components/product/app-shell/app-shell";

const PLAN_LABELS: Record<string, string> = {
  premium_monthly: "Premium",
  premium_yearly: "Premium",
};

// M3 Slice 1 (docs/ui/unified-ui-slice-1-plan.md): раньше здесь была
// ручная разметка header+<Nav/> без desktop-навигации вообще
// (docs/ui/current-ui-audit.md §1) — AppShell добавляет DesktopSidebar
// (md+) рядом с той же мобильной раскладкой, ничего не удаляя.
//
// M3 Slice 9 (plan doc §11/§16/§19): onboarding-v2 gate. Deliberately here
// (a layout, re-run on every navigation) and NOT inside requireProfile()
// itself — requireProfile() is also called from inside Server Actions
// (e.g. submitKnowledgeCheckAction, mid-first-action), where a redirect()
// would hijack the action's response instead of returning the data its
// caller expects. /learning-paths/** is allowed straight through even when
// onboarding isn't complete — that's the real, legitimate first-action
// journey the onboarding result screen itself redirects into; every other
// (app) route bounces back to /onboarding/result, which self-resolves to
// either the recommendation/path-choice UI or a "continue your first step"
// CTA depending on what's actually in the DB (never a stored, driftable
// flag on the request).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!profile.completed_first_win) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/learning-paths")) {
      const target = await resolveOnboardingUrl(supabase, profile);
      if (target) redirect(target);
    }
  }

  const plan = await getPlan(supabase, profile.id);

  return (
    <>
      <PostHogProvider userId={profile.id} />
      <AppShell planLabel={PLAN_LABELS[plan] ?? null}>{children}</AppShell>
    </>
  );
}
