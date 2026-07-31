import Link from "next/link";

// Раздел 5 промта 2026-07-30 (запуск): раньше корневой URL для незалогиненного
// посетителя сразу редиректил в мастер онбординга — ни слова о продукте, ни
// одного скриншота. Копирайт переиспользован из первого шага онбординга.
export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Учи язык, читая то, что интересно
      </h1>
      <p className="mt-4 text-black/60 dark:text-white/60">
        Никаких упражнений и геймификации. Читай реальные тексты, сохраняй
        незнакомые слова одним тапом и повторяй их по расписанию.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: "linear-gradient(135deg, #2f5d50, #1f3f37)" }}
        >
          <p className="text-xs opacity-80">A1 · Рассказ</p>
          <p className="mt-1 font-semibold">Утро в кофейне</p>
        </div>
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: "linear-gradient(135deg, #a8451f, #7a3016)" }}
        >
          <p className="text-xs opacity-80">B1 · Рассказ</p>
          <p className="mt-1 font-semibold">Побег из города</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/onboarding"
          className="rounded-full bg-black px-5 py-3 text-center font-medium text-white transition-colors hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Начать бесплатно
        </Link>
        <Link href="/login" className="text-center text-sm text-black/50 underline dark:text-white/50">
          Уже есть аккаунт? Войти
        </Link>
      </div>
    </div>
  );
}
