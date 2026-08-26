import { requireProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/subscription";
import PageHeader from "@/components/product/page-header";
import SettingsClient from "./settings-client";
import { listExtensionTokens } from "./extension-actions";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const user = await getSessionUser();

  const [plan, { count: pushCount }, { data: subscription }, extensionTokens] = await Promise.all([
    getPlan(supabase, profile.id),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id),
    // M3 UI slice 2 — только чтение, тот же паттерн, что уже используется
    // на /pricing (не трогаем Stripe-код, docs/ui/slice2-data-audit.md §3).
    supabase
      .from("subscriptions")
      .select("status, current_period_end, stripe_customer_id")
      .eq("owner_id", profile.id)
      .maybeSingle(),
    listExtensionTokens(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Настройки" />
      <SettingsClient
        email={user?.email ?? ""}
        createdAt={profile.created_at}
        targetLanguage={profile.target_language}
        nativeLanguage={profile.native_language}
        level={profile.level}
        dailyWordGoal={profile.daily_word_goal}
        plan={plan}
        subscriptionStatus={subscription?.status ?? null}
        subscriptionPeriodEnd={subscription?.current_period_end ?? null}
        hasStripeCustomer={Boolean(subscription?.stripe_customer_id)}
        initialPushEnabled={(pushCount ?? 0) > 0}
        extensionTokens={extensionTokens}
        leaderboardOptIn={profile.leaderboard_opt_in}
      />
    </div>
  );
}
