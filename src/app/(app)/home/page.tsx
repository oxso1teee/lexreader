import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import { getDueCount } from "@/lib/brain-stats";
import TodayCard from "./today-card";
import UpsellStrip from "./upsell-strip";
import ContinueReadingCard from "./continue-reading-card";

function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [
    plan,
    { count: wordCount },
    { count: textCount },
    { count: newWordsToday },
    dueCount,
    { data: continueRows },
  ] = await Promise.all([
    getPlan(supabase, profile.id),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language),
    supabase
      .from("texts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .gte("created_at", todayStartUtc()),
    getDueCount(supabase, profile.id, profile.target_language),
    supabase
      .from("text_progress")
      .select("percent_read, last_read_at, texts!inner(id, title, language, owner_id)")
      .eq("owner_id", profile.id)
      .eq("texts.language", profile.target_language)
      .gt("percent_read", 4)
      .lt("percent_read", 96)
      .order("last_read_at", { ascending: false })
      .limit(1),
  ]);

  const continuing = continueRows?.[0] as
    | { percent_read: number; texts: { id: string; title: string } | { id: string; title: string }[] }
    | undefined;
  const continueText = continuing
    ? (Array.isArray(continuing.texts) ? continuing.texts[0] : continuing.texts)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-4">
      <TodayCard
        createdAt={profile.created_at}
        targetLanguage={profile.target_language}
        wordCount={wordCount ?? 0}
        textCount={textCount ?? 0}
        dueCount={dueCount}
        newWordsToday={newWordsToday ?? 0}
        dailyGoal={profile.daily_word_goal}
        streak={profile.streak_current}
      />

      {continueText && (
        <ContinueReadingCard
          textId={continueText.id}
          title={continueText.title}
          percentRead={continuing!.percent_read}
        />
      )}

      {plan === "free" && <UpsellStrip />}
    </div>
  );
}
