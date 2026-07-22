export default function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-6xl">📓</span>
      <p className="text-lg font-bold">Тетрадь пуста</p>
      <p className="max-w-xs text-sm text-black/50 dark:text-white/50">
        Откройте карточки, нажмите на слово и добавьте его в тетрадь
      </p>
    </div>
  );
}
