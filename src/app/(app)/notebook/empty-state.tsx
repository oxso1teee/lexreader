import SharedEmptyState from "@/components/empty-state";

export default function EmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <SharedEmptyState
      icon={filtered ? "🔍" : "📓"}
      title={filtered ? "Ничего не найдено" : "Тетрадь пуста"}
      body={
        filtered
          ? "Попробуй изменить запрос поиска или выбрать другой фильтр."
          : "Откройте карточки, нажмите на слово и добавьте его в тетрадь"
      }
    />
  );
}
