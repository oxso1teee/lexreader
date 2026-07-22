export default function OfflinePage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-4xl">📡</p>
      <h1 className="text-xl font-semibold">Нет соединения</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Эта страница ещё не открывалась без интернета, поэтому её нет в офлайн-кеше. Проверь
        соединение и попробуй снова — уже открытые тексты и страницы останутся доступны офлайн.
      </p>
    </div>
  );
}
