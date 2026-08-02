import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/subscription";
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
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const plan = await getPlan(supabase, profile.id);

  return (
    <>
      <PostHogProvider userId={profile.id} />
      <AppShell planLabel={PLAN_LABELS[plan] ?? null}>{children}</AppShell>
    </>
  );
}
