import Link from "next/link";

// Найдено при повторном аудите: карточка показывалась вечно, независимо от
// возраста аккаунта — выглядела странно для пользователя, который уже
// недели пользуется приложением. Показываем только первые 7 дней; вынесено
// из тела компонента, чтобы не звать Date.now() напрямую в рендере
// (react-hooks/purity), см. тот же приём в progress/page.tsx.
function isNewAccount(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() <= 7 * 86_400_000;
}

export default function WelcomeCard({ createdAt }: { createdAt: string }) {
  if (!isNewAccount(createdAt)) return null;

  return (
    <Link
      href="/library"
      className="block rounded-2xl bg-caramel-light p-5 text-white shadow-sm"
    >
      <span className="text-3xl">👋</span>
      <h3 className="mt-2 text-xl font-bold">Добро пожаловать в LexReader!</h3>
      <p className="mt-1 text-sm text-white/85">
        Начни изучение языка с чтения и карточек.
      </p>
    </Link>
  );
}
