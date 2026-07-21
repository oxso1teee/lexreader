import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/subscription";
import { languageName } from "@/lib/languages";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [plan, { count: pushCount }] = await Promise.all([
    getPlan(supabase, profile.id),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
      <h1 className="mb-4 text-xl font-semibold">Настройки</h1>
      <SettingsClient
        targetLanguage={languageName(profile.target_language)}
        nativeLanguage={languageName(profile.native_language)}
        level={profile.level}
        dailyWordGoal={profile.daily_word_goal}
        plan={plan}
        initialPushEnabled={(pushCount ?? 0) > 0}
      />
    </div>
  );
}
