import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/ui/cx";

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

// tone — смысловая подложка (макеты: .card.t-green/t-blue/t-gold/t-orange/
// t-red/sunk): leaf — успех/прогресс, sky — память/информация, sun —
// награды/Plus, ember — стрик/срочное, danger — ошибка, sunken —
// утопленный блок. dashed — «добавить»/пустой слот.
export type CardTone = "leaf" | "sky" | "sun" | "ember" | "danger" | "sunken";

interface CardStyleProps {
  tone?: CardTone;
  dashed?: boolean;
}

export function cardClassName({
  interactive = false,
  tone,
  dashed = false,
  className,
}: { interactive?: boolean; className?: string } & CardStyleProps = {}) {
  return cx("card", interactive && "card-interactive", tone && `card-tone-${tone}`, dashed && "card-dashed", className);
}

export function Card({
  as: Tag = "div",
  tone,
  dashed,
  className,
  ...props
}: { as?: CardTag } & CardStyleProps & ComponentProps<"div">) {
  return <Tag className={cardClassName({ tone, dashed, className })} {...props} />;
}

export function CardLink({
  tone,
  dashed,
  className,
  ...props
}: CardStyleProps & ComponentProps<typeof Link>) {
  return <Link className={cardClassName({ interactive: true, tone, dashed, className })} {...props} />;
}
