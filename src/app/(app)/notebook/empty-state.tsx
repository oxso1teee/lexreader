export default function EmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-6xl">{filtered ? "🔍" : "📓"}</span>
      <p className="text-lg font-bold">{filtered ? "Ничего не найдено" : "Тетрадь пуста"}</p>
      <p className="max-w-xs text-sm text-black/50 dark:text-white/50">
        {filtered
          ? "Попробуй изменить запрос поиска или выбрать другой фильтр."
          : "Откройте карточки, нажмите на слово и добавьте его в тетрадь"}
      </p>
    </div>
  );
}
