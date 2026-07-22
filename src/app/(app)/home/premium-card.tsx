import Link from "next/link";

const FEATURES = [
  { icon: "🎧", text: "Режим слушать и следить" },
  { icon: "📖", text: "Импорт статей и видео" },
  { icon: "🧠", text: "Контекстный ИИ-перевод" },
  { icon: "🔄", text: "Интервальное повторение карточек" },
  { icon: "📊", text: "Расширенная статистика" },
];

export default function PremiumCard() {
  return (
    <div className="rounded-2xl border border-purple-400/30 bg-indigo-card p-5 text-white shadow-sm">
      <span className="text-3xl">⭐</span>
      <p className="mt-2 text-xs font-semibold tracking-wide text-purple-300 uppercase">
        LexReader Премиум
      </p>
      <h3 className="mt-1 text-2xl font-bold">Выберите ваш план</h3>
      <hr className="my-3 border-white/15" />
      <ul className="flex flex-col gap-2 text-sm text-white/85">
        {FEATURES.map((f) => (
          <li key={f.text} className="flex items-center gap-2">
            <span>{f.icon}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/pricing"
        className="mt-4 block rounded-full bg-purple-100 py-3 text-center font-medium text-indigo-950"
      >
        Смотреть планы →
      </Link>
    </div>
  );
}
