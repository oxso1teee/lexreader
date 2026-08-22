import Link from "next/link";
import { BookOpen, MousePointerClick, RotateCw, type LucideIcon } from "lucide-react";

// Раздел B.6 файла 10: раньше это была mobile-only "quickwins"-страница
// (max-w-md, без desktop-версии) — на широком экране просто узкая колонка
// посреди пустого фона. Копирайт первого экрана (headline/subhead/два
// превью-карточки) — тот же, что был здесь и в первом шаге онбординга
// (раздел 5 промта 2026-07-30), просто в полноценном hero-макете с
// desktop-раскладкой и содержательным блоком "как это работает" вместо
// одного экрана.
const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: BookOpen, title: "Читай", body: "Реальные тексты и субтитры — не выдуманные учебные диалоги." },
  {
    icon: MousePointerClick,
    title: "Тапай",
    body: "Незнакомое слово — сразу перевод в контексте, одним касанием.",
  },
  { icon: RotateCw, title: "Повторяй", body: "Слово само возвращается на карточке по расписанию SRS." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold tracking-tight">LexReader</span>
        <Link
          href="/login"
          className="focus-ring text-body-sm font-medium text-[var(--text-secondary)] hover:text-foreground"
        >
          Войти
        </Link>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-8 md:grid-cols-2 md:gap-16 md:py-16">
          <div className="flex flex-col gap-5">
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Учи язык, читая то, что интересно
            </h1>
            <p className="text-body text-[var(--text-secondary)] md:text-lg">
              Никаких упражнений и геймификации. Читай реальные тексты, сохраняй незнакомые слова
              одним тапом и повторяй их по расписанию.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/onboarding"
                className="focus-ring flex min-h-12 items-center justify-center rounded-full bg-[var(--color-primary)] px-6 font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
              >
                Начать бесплатно
              </Link>
              <Link
                href="/login"
                className="focus-ring text-body-sm text-[var(--text-secondary)] underline underline-offset-2 sm:no-underline sm:hover:underline"
              >
                Уже есть аккаунт? Войти
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className="col-span-2 rounded-2xl p-5 text-white sm:col-span-1"
              style={{ background: "linear-gradient(135deg, #2f5d50, #1f3f37)" }}
            >
              <p className="text-xs opacity-80">A1 · Рассказ</p>
              <p className="mt-1 text-lg font-semibold">Утро в кофейне</p>
            </div>
            <div
              className="col-span-2 rounded-2xl p-5 text-white sm:col-span-1"
              style={{ background: "linear-gradient(135deg, #a8451f, #7a3016)" }}
            >
              <p className="text-xs opacity-80">B1 · Рассказ</p>
              <p className="mt-1 text-lg font-semibold">Побег из города</p>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="flex flex-col gap-2">
                <s.icon aria-hidden="true" className="h-6 w-6 text-[var(--color-primary)]" />
                <h2 className="text-h3">{s.title}</h2>
                <p className="text-body-sm text-[var(--text-secondary)]">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-6 py-16 text-center">
          <h2 className="text-h1 max-w-xl">Начни с текста, который правда хочется дочитать</h2>
          <Link
            href="/onboarding"
            className="focus-ring flex min-h-12 items-center justify-center rounded-full bg-[var(--color-primary)] px-8 font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
          >
            Начать бесплатно
          </Link>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap gap-4 px-6 py-6 text-caption text-[var(--text-secondary)]">
        <Link href="/changelog" className="focus-ring underline">
          Что нового
        </Link>
        <Link href="/terms" className="focus-ring underline">
          Условия использования
        </Link>
        <Link href="/privacy" className="focus-ring underline">
          Конфиденциальность
        </Link>
      </footer>
    </div>
  );
}
