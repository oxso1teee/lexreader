import Link from "next/link";
import type { ComponentProps } from "react";

// redesign/duolingo-flat, phase 4 — стиль в src/styles/card.css. Заменяет
// повторяющийся `rounded-2xl bg-card p-4 shadow-sm`; экраны переезжают на
// него в фазах 6-12. Как и у Button, две обёртки вместо полиморфного `as`
// с произвольным компонентом: <Card> для статичного блока (тег — только
// div/section/article), <CardLink> для навигации (next/link, hover-рамка).
// Паддинг по умолчанию 1rem — переопределяется утилитой (p-6, px-4 py-3…).
//
// Пример:
//   <Card className="flex flex-col gap-2">…</Card>
//   <Card as="section" className="p-6 text-center">…</Card>
//   <CardLink href="/leaderboard" className="flex items-center justify-between gap-3">…</CardLink>
type CardTag = "div" | "section" | "article";

export function cardClassName({
  interactive = false,
  className,
}: { interactive?: boolean; className?: string } = {}) {
  return ["card", interactive && "card-interactive", className].filter(Boolean).join(" ");
}

export function Card({
  as: Tag = "div",
  className,
  ...props
}: { as?: CardTag } & ComponentProps<"div">) {
  return <Tag className={cardClassName({ className })} {...props} />;
}

export function CardLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cardClassName({ interactive: true, className })} {...props} />;
}
