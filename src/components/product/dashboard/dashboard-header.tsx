import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BoltIcon, FlameIcon } from "@/components/product/today/v7/icons";
import { pluralRu } from "@/lib/plural-ru";

export interface DashboardHeaderProps {
  langCode: string;
  level: string | null;
  streak: number;
  /** Серии нет или она прервана — пилюля приглушена, огонь не «горит». */
  streakIdle: boolean;
  xp: number;
  /** Имя из входа через Google/Apple; в профиле его нет. */
  avatarName: string | null;
  /** Только для инициалов аватара — на экран не выводится. */
  avatarEmail: string | null;
  /** Чип «Двойной опыт», если буст активен. */
  boostChip?: ReactNode;
}

// Верхний ряд: язык и уровень слева, справа серия, XP и профиль (аватар).
// Каждая пилюля — ссылка с понятным именем и зоной нажатия 44px.
export default function DashboardHeader(props: DashboardHeaderProps) {
  const streakLabel =
    props.streak > 0
      ? `Серия: ${props.streak} ${pluralRu(props.streak, "день", "дня", "дней")} подряд`
      : "Серии пока нет";
  const xpText = props.xp.toLocaleString("ru-RU");
  return (
    <div className="dash-pills" role="group" aria-label="Мои показатели">
      <Link
        href="/settings"
        className="dash-pill dash-pill-lang"
        aria-label={`Язык: ${props.langCode}${props.level ? `, уровень ${props.level}` : ""}`}
      >
        <span className="dash-pill-code" aria-hidden="true">
          {props.langCode}
        </span>
        <span>{props.level ?? "Язык"}</span>
      </Link>
      <div className="dash-pills-end">
        {props.boostChip}
        <Link
          href="/streak"
          className="dash-pill dash-pill-streak"
          data-idle={props.streakIdle ? "true" : undefined}
          aria-label={streakLabel}
        >
          {props.streakIdle ? <FlameIcon size={20} fill="var(--text-secondary)" inner={null} /> : <FlameIcon size={20} />}
          {props.streak}
        </Link>
        <Link href="/progress" className="dash-pill dash-pill-xp" aria-label={`${xpText} XP`}>
          <BoltIcon size={18} />
          {xpText}
        </Link>
        <Link href="/settings" className="dash-avatar-link" aria-label="Профиль">
          <Avatar name={props.avatarName ?? undefined} email={props.avatarEmail ?? undefined} />
        </Link>
      </div>
    </div>
  );
}
