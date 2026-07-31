import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import { getDueCount } from "@/lib/brain-stats";
import PremiumCard from "./premium-card";
import WelcomeCard from "./welcome-card";
import InfoCard from "./info-card";
import AccountStrip from "./account-strip";
import TodayCard from "./today-card";
import SecondaryTips from "./secondary-tips";
import InstallBanner from "./install-banner";
import ScreenHeader from "@/components/screen-header";

function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Найдено при повторном аудите: карточка "Выберите ваш план" показывалась
  // и уже оплатившим Premium — выглядит так, будто оплата не сработала.
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
      <ScreenHeader icon="🏠" title="Главная" />

      <AccountStrip
        plan={plan}
        wordCount={wordCount ?? 0}
        textCount={textCount ?? 0}
        targetLanguage={profile.target_language}
      />

      <InstallBanner />

      <TodayCard
        current={newWordsToday ?? 0}
        goal={profile.daily_word_goal}
        streak={profile.streak_current}
        dueCount={dueCount}
        newWordsToday={newWordsToday ?? 0}
        continueReading={
          continueText
            ? { textId: continueText.id, title: continueText.title, percentRead: continuing!.percent_read }
            : null
        }
      />

      <SecondaryTips>
        <WelcomeCard createdAt={profile.created_at} />
        {plan === "free" && <PremiumCard />}
        <InfoCard
          variant="tip"
          icon="💡"
          label="Learning tip"
          title="Читай то, что интересно"
          body="Выбирай тексты, которые ты бы читал(а) и на родном языке. Живой интерес держит внимание и заметно улучшает запоминание слов из контекста."
        />
      </SecondaryTips>
    </div>
  );
}
