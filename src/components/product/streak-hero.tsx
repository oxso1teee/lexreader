import { Playfair_Display } from "next/font/google";

// Progress mockup alignment — scoped Playfair Display, тот же паттерн, что
// уже в library/page.tsx (--font-library-serif) и read/[textId]/page.tsx
// (--font-reading): локальная next/font/google-загрузка с уникальным именем
// переменной прямо в этом файле, не через общий --font-serif (тот подключён
// только внутри landing-page.tsx). StreakHero — Server Component (без "use
// client"), поэтому можно грузить шрифт прямо тут же, без прокидки через
// page.tsx.
const playfairDisplay = Playfair_Display({
  variable: "--font-streak-hero",
  subsets: ["latin", "cyrillic"],
});

// Progress mockup alignment — раньше горизонтальная карточка с
// иконкой-кружком Flame слева (тёплый оранжевый --color-warning) и
// числом+подписью справа. Референс хочет центрированную карточку без
// иконки — крупное italic-число сверху, подпись под ним. StreakHero больше
// нигде не используется (PR #76 убрал его с /home — см. комментарий в
// home/page.tsx), меняем свободно.
//
// Цвет числа — --color-forest-text, не голый --color-forest: тот не
// переопределён в тёмной теме (остаётся тёмно-зелёным #1f4d3b и на тёмном
// --card), а --color-forest-text для того и существует в токенах — тот же
// #1f4d3b в светлой, но более яркий #34d399 в тёмной специально для
// текста/цифр поверх --card. Проверено вручную по формуле WCAG
// относительной яркости (та же методика, что и в review-session.tsx):
// светлая тема ~9.6:1, тёмная ~8.6:1 — обе с большим запасом выше 4.5:1.
export default function StreakHero({ days, bestStreak }: { days: number; bestStreak: number }) {
  // "— личный рекорд" только когда это реально правда: есть хоть один день
  // стрика И текущий стрик уже догнал/обогнал лучший исторический (тот же
  // profile.streak_longest, что уже читает PersonalRecords ниже на этой
  // странице) — не выдумываем рекорд, когда его нет.
  const isRecord = days > 0 && days >= bestStreak;

  return (
    <div className={`${playfairDisplay.variable} rounded-2xl bg-card px-0 pb-[6px] pt-[10px] text-center shadow-sm`}>
      <p className="font-[family-name:var(--font-streak-hero)] text-[52px] font-bold italic leading-none text-[var(--color-forest-text)]">
        {days}
      </p>
      <p className="mt-1 text-[11.5px] text-[var(--text-secondary)]">
        {days === 1 ? "день подряд" : "дней подряд"}
        {isRecord && " — личный рекорд"}
      </p>
    </div>
  );
}
