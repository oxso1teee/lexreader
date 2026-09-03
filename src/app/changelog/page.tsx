import Link from "next/link";

// Раздел 5 промта 2026-07-30 (рост): статичный список — укрепляет ощущение
// "за продуктом кто-то следит", без БД и без миграций.
const ENTRIES = [
  {
    date: "2026-07-30",
    title: "Единый визуальный язык",
    body: "Главная, Библиотека и Мозг собраны в цельные панели вместо стопки карточек. Своя иконка навигации, звания и XP, личные рекорды на Статистике.",
  },
  {
    date: "2026-07-30",
    title: "Готовность к запуску",
    body: "Публичная посадочная страница, честный выбор языка (лист ожидания вместо пустой библиотеки), пробный период Premium.",
  },
  {
    date: "2026-07-30",
    title: "Слова из чтения и Мозг — теперь один раздел",
    body: "Слово, сохранённое во время чтения, сразу встаёт на настоящее интервальное повторение.",
  },
  {
    date: "2026-07-28",
    title: "Достижения, квест недели, заморозка стрика",
    body: "Пропуск одного дня в неделю больше не обнуляет серию. Плюс бейджи за конкретные результаты.",
  },
  {
    date: "2026-07-28",
    title: "Обложки библиотеки и текст дня",
    body: "19 новых коротких историй по уровням A1-B2, у каждого текста — своя обложка.",
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-10">
      {/* forest-text-contrast-fix: text-forest -> --color-forest-text (see
          progress/stat-card.tsx). */}
      <Link href="/settings" className="text-sm text-[var(--color-forest-text)]">
        ← Настройки
      </Link>
      <h1 className="text-2xl font-bold">Что нового</h1>
      <div className="flex flex-col gap-3">
        {ENTRIES.map((e) => (
          <div key={e.title} className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs text-black/40 dark:text-white/40">{e.date}</p>
            <p className="mt-1 font-semibold">{e.title}</p>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">{e.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
