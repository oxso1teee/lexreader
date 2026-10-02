// Progress mockup alignment — раньше горизонтальная карточка с
// иконкой-кружком Flame слева (тёплый оранжевый --color-warning) и
// числом+подписью справа. Референс хочет центрированную карточку без
// иконки — крупное число сверху, подпись под ним. Используется только на
// /progress (PR #76 убрал его с /home — см. комментарий в home/page.tsx).
//
// Фаза 13m: число раньше было scoped Playfair Display italic 52px — теперь
// общий дисплейный font-display (Unbounded, уже грузится в layout.tsx, без
// своей загрузки шрифта). Unbounded без italic-начертания (только 700/900) —
// italic убран, чтобы не было синтетического наклона. 44px, не 52: у
// Playfair цифры старостильные (ink "1" при 52px ≈ 28px), у Unbounded —
// широкие лайнинговые (ink "1" при 44px ≈ 33px), так что 44px уже крупнее
// и плотнее прежнего, а 52px перегружает карточку.
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
    <div className="rounded-2xl bg-[var(--surface)] px-0 pb-[6px] pt-[10px] text-center">
      <p className="font-display text-[44px] font-bold leading-none text-[var(--color-forest-text)]">
        {days}
      </p>
      <p className="mt-1 text-[11.5px] text-[var(--text-secondary)]">
        {days === 1 ? "день подряд" : "дней подряд"}
        {isRecord && " — личный рекорд"}
      </p>
    </div>
  );
}
