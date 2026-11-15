// Блок «Хочешь ещё?» (макет Today-done): когда цель дня выполнена, главное
// действие перестаёт быть обязательным и становится одним из необязательных.
// Здесь только отбор без дублей; сами тексты главного действия приходят уже
// готовыми из page.tsx (миссия > повтор > чтение > добавить материал).
export interface WantMoreHero {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  href: string;
  actionType: string;
}

export interface WantMoreInput {
  hero: WantMoreHero;
  continueReading: { textId: string; title: string; percentRead: number } | null;
  dueCount: number;
}

export type WantMoreItem =
  | { kind: "primary"; hero: WantMoreHero }
  | { kind: "reading"; href: string; title: string; percentRead: number }
  | { kind: "review"; href: string; dueCount: number };

export function buildWantMore(input: WantMoreInput): WantMoreItem[] {
  const items: WantMoreItem[] = [{ kind: "primary", hero: input.hero }];
  if (input.continueReading && input.hero.actionType !== "continue_reading") {
    items.push({
      kind: "reading",
      href: `/read/${input.continueReading.textId}`,
      title: input.continueReading.title,
      percentRead: input.continueReading.percentRead,
    });
  }
  if (input.dueCount > 0 && input.hero.actionType !== "review") {
    items.push({ kind: "review", href: "/brain/all/review", dueCount: input.dueCount });
  }
  return items;
}
