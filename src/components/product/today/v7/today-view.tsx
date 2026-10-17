import Link from "next/link";
import { Copy } from "lucide-react";
import { Card, CardLink } from "@/components/ui/card";
import { categoryLabel } from "@/components/product/language-twin/badges";
import ContinueLearningCard from "@/components/product/today/continue-learning-card";
import QuickActionsCard from "@/components/product/today/quick-actions-card";
import { messages } from "@/lib/i18n";
import type { DayMark } from "@/lib/week-marks";
import type { PatternCategory, PatternRow, PatternStatus } from "@/lib/language-twin/types";
import TodayHero from "./today-hero";
import WeekCard from "./week-card";
import { BoltIcon, FlameIcon, MascotSmall } from "./icons";

const t = messages.today;

const PATTERN_STATUS_PHRASE: Partial<Record<PatternStatus, string>> = {
  active: "в фокусе",
  improving: "улучшается",
  uncertain: "нужно проверить",
};

export interface TodayViewProps {
  analytics?: React.ReactNode;
  installBanner?: React.ReactNode;
  langCode: string;
  level: string | null;
  streak: number;
  streakLongest: number;
  xp: number;
  greeting: string;
  firstName: string | null;
  wordsToday: number;
  goal: number;
  dueCount: number;
  marks: DayMark[];
  hero: { eyebrow?: string; title: string; meta: string[]; ctaLabel: string; href: string; actionType: string; footnote?: string };
  continueReading: { textId: string; title: string; percentRead: number } | null;
  continueIsVideo: boolean;
  pathCard: { href: string; label: string; title: string } | null;
  pendingRecommendationsCount: number;
  topPatterns: Pick<PatternRow, "category" | "title" | "status">[];
}

// docs/moments/mockups/Main.dc.html — раскладка 1:1 с макетом v7. Только
// вид: все данные считает (app)/home/page.tsx, а галерея /dev/screens
// подставляет тестовые для скриншот-сверки. Ниже макета — карточки,
// которых на нём нет, но которые несут реальную функциональность (путь,
// рекомендации, «Мой английский», быстрые действия) — их не убираем.
export default function TodayView(props: TodayViewProps) {
  const { langCode, level, wordsToday, goal, dueCount } = props;
  const goalLeft = Math.max(0, goal - wordsToday);
  const goalPct = goal > 0 ? Math.min(1, wordsToday / goal) : 0;
  const ring = 2 * Math.PI * 18;
  return (
    <div className="td-root">
      {props.analytics}

      <div className="td-topbar">
        <Link href="/settings" className="td-chip td-lang" aria-label={`Язык: ${langCode}${level ? `, уровень ${level}` : ""}`}>
          <span className="td-lang-code">{langCode}</span>
          {level ?? "Язык"}
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/progress" className="td-chip td-streak" aria-label={`Стрик ${props.streak}`}>
            <FlameIcon size={20} />
            {props.streak}
          </Link>
          <Link href="/progress" className="td-chip td-xp" aria-label={`${props.xp} XP`}>
            <BoltIcon size={18} />
            {props.xp.toLocaleString("ru-RU")}
          </Link>
        </div>
      </div>

      <div className="td-greet">
        <div className="td-bob" style={{ width: 56, height: 66, flex: "none" }}>
          <MascotSmall size={56} />
        </div>
        <div>
          <h1 className="td-disp" style={{ margin: 0, fontSize: 22, lineHeight: 1.15, fontWeight: 700 }}>
            {props.firstName ? `${props.greeting}, ${props.firstName}` : `${props.greeting}!`}
          </h1>
          <div className="td-muted" style={{ fontSize: 14, marginTop: 4 }}>
            {goalLeft > 0 ? `Ещё ${goalLeft} ${wordsWord(goalLeft)} до цели дня` : "Цель дня выполнена"}
          </div>
        </div>
      </div>

      {props.installBanner}

      <TodayHero
        eyebrow={props.hero.eyebrow ?? "Занятие на сегодня"}
        title={props.hero.title}
        meta={props.hero.meta}
        ctaLabel={props.hero.ctaLabel}
        href={props.hero.href}
        actionType={props.hero.actionType}
        footnote={props.hero.footnote}
      />

      <div className="td-tiles">
        <Link href="/progress" className="td-card td-tile">
          <svg viewBox="0 0 44 44" width="48" height="48" role="img" aria-label={`Цель дня ${wordsToday} из ${goal}`} style={{ flex: "none" }}>
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--sun-tint)" strokeWidth="6" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--sun)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(ring * goalPct).toFixed(1)} ${ring.toFixed(1)}`} transform="rotate(-90 22 22)" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div className="td-tile-value">{wordsToday}/{goal}</div>
            <div className="td-muted td-tile-label">новых слов</div>
          </div>
        </Link>
        <Link href="/brain/all/review" className="td-card td-tile">
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--sky-tint)", color: "var(--sky-text)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Copy className="h-[26px] w-[26px]" aria-hidden="true" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="td-tile-value">{dueCount} {wordsWord(dueCount)}</div>
            <div className="td-muted td-tile-label">ждут повтора</div>
          </div>
        </Link>
      </div>

      <WeekCard marks={props.marks} record={props.streakLongest} />

      <div className="td-more">
        <ContinueLearningCard material={props.continueReading} isVideo={props.continueIsVideo} />

        {props.pathCard && (
          <CardLink href={props.pathCard.href} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-secondary)]">Мой путь · {props.pathCard.label}</p>
              <p className="text-body-sm truncate font-medium">{props.pathCard.title}</p>
            </div>
            <span className="shrink-0 text-body-sm font-semibold text-[var(--color-forest-text)]">Продолжить →</span>
          </CardLink>
        )}

        {props.pendingRecommendationsCount > 0 && (
          <CardLink href="/language-twin/recommendations" className="flex items-center justify-between">
            <p className="text-body-sm text-[var(--text-secondary)]">Новых рекомендаций: {props.pendingRecommendationsCount}</p>
            <span className="text-body-sm font-semibold text-[var(--color-forest-text)]">Открыть →</span>
          </CardLink>
        )}

        {props.topPatterns.length > 0 && (
          <Card className="flex flex-col gap-2">
            <h2 className="text-sm font-bold">{t.myEnglish.title}</h2>
            {props.topPatterns.map((p, i) => (
              <Link key={i} href="/language-twin" className="focus-ring text-sm hover:underline">
                {categoryLabel(p.category as PatternCategory)}
                {" — "}
                {PATTERN_STATUS_PHRASE[p.status] ?? p.title}
              </Link>
            ))}
            <Link href="/language-twin" className="focus-ring self-start text-xs font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline">
              Весь профиль →
            </Link>
          </Card>
        )}

        <QuickActionsCard />
      </div>
    </div>
  );
}

function wordsWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "слово";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "слова";
  return "слов";
}
