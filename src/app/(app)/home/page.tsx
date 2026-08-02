import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getDueCount, getReviewsThisWeekCount } from "@/lib/brain-stats";
import { decidePrimaryAction, dueCountBucket, greetingForHour } from "@/lib/today";
import { messages } from "@/lib/i18n";
import PageHeader from "@/components/product/page-header";
import SectionHeader from "@/components/product/section-header";
import PrimaryActionCard from "@/components/product/primary-action-card";
import DailyPlanCard from "@/components/product/today/daily-plan-card";
import ContinueLearningCard from "@/components/product/today/continue-learning-card";
import ReviewSummaryCard from "@/components/product/today/review-summary-card";
import ComingSoonCard from "@/components/product/today/coming-soon-card";
import InstallBanner from "./install-banner";
import TodayAnalytics from "./today-analytics";

const t = messages.today;

function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// M3 Slice 1 — редизайн Today (docs/ui/unified-ui-slice-1-plan.md,
// docs/ui/current-ui-audit.md §3): один primary CTA вместо нескольких
// конкурирующих карточек равного веса. PremiumCard/WelcomeCard/tip-карточка
// сюда намеренно не переносятся — "no unrelated upgrade banner" прямо
// входит в acceptance criteria этого слайса; /pricing и Stripe-flow не
// удаляются, просто больше не занимают место на главном экране. Route
// остаётся /home — только композиция страницы меняется.
export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { count: wordCount },
    { count: newWordsToday },
    dueCount,
    reviewsThisWeek,
    { count: materialsInProgress },
    { data: continueRows },
  ] = await Promise.all([
    supabase
      .from("vocabulary_items")
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
    getReviewsThisWeekCount(supabase, profile.id, profile.target_language),
    supabase
      .from("text_progress")
      .select("text_id, texts!inner(owner_id, language)", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("texts.language", profile.target_language)
      .gt("percent_read", 4)
      .lt("percent_read", 96),
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

  const continuingRow = continueRows?.[0] as
    | { percent_read: number; texts: { id: string; title: string } | { id: string; title: string }[] }
    | undefined;
  const continueTextRaw = continuingRow
    ? (Array.isArray(continuingRow.texts) ? continuingRow.texts[0] : continuingRow.texts)
    : null;
  const continueReading = continueTextRaw
    ? { textId: continueTextRaw.id, title: continueTextRaw.title, percentRead: continuingRow!.percent_read }
    : null;

  const primaryAction = decidePrimaryAction({ dueCount, continueReading });
  const greeting = greetingForHour(new Date().getHours());
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 md:max-w-3xl md:gap-5 md:px-0 md:py-8">
      <TodayAnalytics dueCountBucket={dueCountBucket(dueCount)} hasActiveMaterial={continueReading !== null} />

      <PageHeader title={`${greeting}!`} description={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} />

      <InstallBanner />

      {primaryAction.type === "review" && (
        <PrimaryActionCard
          eyebrow={t.primaryAction.reviewEyebrow}
          title={`${primaryAction.dueCount} к повторению`}
          ctaLabel={t.primaryAction.reviewCta}
          href="/brain/all/review"
          actionType="review"
        />
      )}
      {primaryAction.type === "continue_reading" && (
        <PrimaryActionCard
          eyebrow={t.primaryAction.continueEyebrow}
          title={primaryAction.title}
          description={`${primaryAction.percentRead}% прочитано`}
          ctaLabel={t.primaryAction.continueCta}
          href={`/read/${primaryAction.textId}`}
          actionType="continue_reading"
        />
      )}
      {primaryAction.type === "add_material" && (
        <PrimaryActionCard
          title={t.primaryAction.addMaterialTitle}
          description={t.primaryAction.addMaterialDescription}
          ctaLabel={t.primaryAction.addMaterialCta}
          href="/library/new"
          actionType="add_material"
        />
      )}

      <section className="flex flex-col gap-2">
        <SectionHeader title={t.plan.title} />
        <DailyPlanCard
          metrics={[
            { label: t.plan.due, value: String(dueCount), icon: "📇" },
            { label: "Дневная цель", value: `${newWordsToday ?? 0} / ${profile.daily_word_goal} слов`, icon: "🎯" },
            { label: t.plan.words, value: String(wordCount ?? 0), icon: "📝" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title={t.continueLearning.title} />
        <ContinueLearningCard material={continueReading} />
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title={t.review.title} />
        <ReviewSummaryCard dueCount={dueCount} />
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title={t.progressSnapshot.title} />
        <DailyPlanCard
          metrics={[
            { label: t.plan.streak, value: String(profile.streak_current), icon: "🔥" },
            { label: t.plan.reviewsThisWeek, value: String(reviewsThisWeek), icon: "🔄" },
            ...(materialsInProgress ? [{ label: "В процессе", value: String(materialsInProgress), icon: "📚" }] : []),
          ]}
        />
      </section>

      <ComingSoonCard />
    </div>
  );
}
