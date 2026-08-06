import EmptyState from "@/components/empty-state";

// Distinct from the "not enough data yet" empty state — this means the
// feature's own storage couldn't be reached (e.g. a pending migration on
// this environment), not that the user simply hasn't done anything yet.
// The real technical error is logged server-side (getOrCreateSettings in
// settings.ts); this copy never claims a false cause like "disabled by you."
export default function LanguageTwinUnavailable() {
  return (
    <EmptyState
      icon="🛠️"
      title="Мой английский временно недоступен"
      body="Не получилось загрузить данные этой функции. Твои слова, карточки и история повторений не затронуты — попробуй зайти сюда чуть позже."
    />
  );
}
