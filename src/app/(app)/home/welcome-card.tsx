import Link from "next/link";

export default function WelcomeCard() {
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
