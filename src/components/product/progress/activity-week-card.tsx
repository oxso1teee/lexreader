import EmptyState from "@/components/empty-state";
import SectionHeader from "@/components/product/section-header";

export interface ActivityWeekData {
  readingDays: number;
  sessionsCompleted: number;
  wordsAdded: number;
  reviewsDone: number;
}

// M3 UI slice 2: реальная активность за последние 7 дней (не зависит от
// выбранного PeriodTabs выше на странице — фиксированное окно, как просили
// в задаче). Честный empty state вместо фиктивного графика, если данных нет.
export default function ActivityWeekCard({ data }: { data: ActivityWeekData }) {
  const hasActivity =
    data.readingDays > 0 || data.sessionsCompleted > 0 || data.wordsAdded > 0 || data.reviewsDone > 0;

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
      <SectionHeader title="Активность за 7 дней" />
      {hasActivity ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ActivityMetric label="Дней с чтением" value={data.readingDays} />
          <ActivityMetric label="Сессий чтения завершено" value={data.sessionsCompleted} />
          <ActivityMetric label="Слов добавлено" value={data.wordsAdded} />
          <ActivityMetric label="Повторений сделано" value={data.reviewsDone} />
        </div>
      ) : (
        <EmptyState
          icon="📆"
          title="Пока нет активности за неделю"
          body="Почитай что-нибудь или повтори карточки — активность появится здесь."
        />
      )}
    </div>
  );
}

function ActivityMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-h3">{value}</span>
      <span className="text-caption text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}
