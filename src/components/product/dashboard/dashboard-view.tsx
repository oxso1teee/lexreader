import Link from "next/link";
import type { ReactNode } from "react";
import { Target } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardLink } from "@/components/ui/card";
import { Lex } from "@/components/product/mascot/lex";
import { categoryLabel } from "@/components/product/language-twin/badges";
import { greetingSubline, streakExtendedLine, weekNote } from "@/lib/dashboard/copy";
import type { FirstStepsState } from "@/lib/dashboard/first-steps";
import type { DailyGoalProgress } from "@/lib/dashboard/goal";
import type { DashboardMode } from "@/lib/dashboard/mode";
import type { StreakState } from "@/lib/dashboard/streak";
import type { WantMoreItem } from "@/lib/dashboard/want-more";
import { messages } from "@/lib/i18n";
import type { PatternCategory, PatternRow, PatternStatus } from "@/lib/language-twin/types";
import type { WeekdayMark } from "@/lib/moments/types";
import ContinueSection, { type PathCardData } from "./continue-section";
import DashboardHeader from "./dashboard-header";
import DashboardHero, { type DashboardHeroProps } from "./dashboard-hero";
import FirstStepsCard from "./first-steps-card";
import GoalDoneHero from "./goal-done-hero";
import { DateLine, Greeting } from "./greeting";
import QuickActions from "./quick-actions";
import { DueTile, GoalTile } from "./stat-tiles";
import WantMore from "./want-more";
import WeekCard from "./week-card";

const t = messages.today;

const PATTERN_STATUS_PHRASE: Partial<Record<PatternStatus, string>> = {
  active: "в фокусе",
  improving: "улучшается",
  uncertain: "нужно проверить",
};

// Всё, что нужно главному экрану, уже посчитано в home/page.tsx из реальных
// данных (профиль, activity_days, text_progress, повторения, путь…) — здесь
// только вид. Узлы (analytics, installBanner, boostChip, questsCard) —
// готовые клиентские блоки, которые страница создаёт сама.
export interface DashboardViewProps {
  mode: DashboardMode;
  analytics?: ReactNode;
  installBanner?: ReactNode;
  boostChip?: ReactNode;
  questsCard?: ReactNode;
  /** Названия блоков, которые не удалось загрузить; пусто — всё в порядке. */
  notices?: string[];

  serverGreeting: string;
  firstName: string | null;
  /** Только для инициалов аватара — на экран не выводится. */
  email: string | null;

  langCode: string;
  level: string | null;
  xp: number;
  streak: { value: number; longest: number; state: StreakState };
  goal: DailyGoalProgress;
  /** Итоги дня для состояния «цель выполнена» (только ненулевые). */
  summary: string[];
  dueCount: number;
  week: WeekdayMark[];
  todayColumn: number;

  /** Подпись цели из онбординга (profiles.primary_goal). */
  learningGoal: string | null;
  /** «B1 → B2» активного учебного пути. */
  pathLabel: string | null;

  hero: Omit<DashboardHeroProps, "eyebrow"> & { eyebrow?: string };
  continueReading: { textId: string; title: string; percentRead: number } | null;
  continueIsVideo: boolean;
  lastActivity: string | null;
  path: PathCardData | null;
  showPathInvite: boolean;

  firstSteps: FirstStepsState | null;
  wantMore: WantMoreItem[];

  pendingRecommendationsCount: number;
  topPatterns: Pick<PatternRow, "category" | "title" | "status">[];
}

function RecommendationsLink({ count }: { count: number }) {
  return (
    <CardLink href="/language-twin/recommendations" className="flex items-center justify-between gap-3">
      <p className="m-0 text-sm text-[var(--text-secondary)]">Новых рекомендаций: {count}</p>
      <span className="shrink-0 text-sm font-semibold text-[var(--color-forest-text)]">Открыть →</span>
    </CardLink>
  );
}

function MyEnglishCard({ patterns }: { patterns: DashboardViewProps["topPatterns"] }) {
  return (
    <Card as="section" aria-labelledby="dash-twin-title" className="flex flex-col gap-2">
      <h2 id="dash-twin-title" className="m-0 text-sm font-bold">
        {t.myEnglish.title}
      </h2>
      {patterns.map((p, i) => (
        <PatternLink key={i} category={p.category as PatternCategory} status={p.status} title={p.title} />
      ))}
      <Link
        href="/language-twin"
        className="focus-ring self-start text-xs font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
      >
        Весь профиль →
      </Link>
    </Card>
  );
}

function PatternLink({ category, status, title }: { category: PatternCategory; status: PatternStatus; title: string }) {
  return (
    <Link href="/language-twin" className="focus-ring text-sm hover:underline">
      {categoryLabel(category)}
      {" — "}
      {PATTERN_STATUS_PHRASE[status] ?? title}
    </Link>
  );
}

export default function DashboardView(props: DashboardViewProps) {
  const { mode, goal, streak } = props;
  const goalDone = mode === "goal-done";
  const heroEyebrow = props.hero.eyebrow ?? (mode === "first-day" ? "Твой первый шаг" : "Занятие на сегодня");

  return (
    <div className="dash page-wide" data-mode={mode}>
      {props.analytics}

      <div className="dash-top">
        <DashboardHeader
          langCode={props.langCode}
          level={props.level}
          streak={streak.value}
          streakIdle={streak.value === 0}
          xp={props.xp}
          avatarName={props.firstName}
          avatarEmail={props.email}
          boostChip={props.boostChip}
        />
        <div className="dash-greet">
          <Lex mood={mode === "first-day" ? "wink" : "happy"} size={56} bob className="shrink-0" />
          <div className="min-w-0">
            <Greeting serverGreeting={props.serverGreeting} firstName={props.firstName} />
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">{greetingSubline(mode, goal)}</p>
            <DateLine className="m-0 mt-0.5 hidden min-h-4 text-xs text-[var(--text-secondary)] @4xl:block" />
            {(props.learningGoal || props.pathLabel) && (
              <ul aria-label="Цель обучения" className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                {props.learningGoal && (
                  <li>
                    <Badge tone="leaf">
                      <Target aria-hidden="true" className="h-3.5 w-3.5" />
                      <span className="sr-only">Цель: </span>
                      {props.learningGoal}
                    </Badge>
                  </li>
                )}
                {props.pathLabel && (
                  <li>
                    <Badge tone="sky">Путь {props.pathLabel}</Badge>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      {props.notices && props.notices.length > 0 && (
        <Alert tone="warning" title="Часть данных сейчас недоступна">
          {props.notices.join(", ")}. Обнови страницу чуть позже.
        </Alert>
      )}

      {props.installBanner}

      {/* Узко обёртки .dash-main/.dash-aside «растворяются» (display: contents),
          и секции выстраиваются по order — как на макете: hero, плитки, шаги,
          неделя, продолжение… Порядок для скринридера и Tab при этом идёт по
          DOM (сначала основная колонка, затем боковая); все секции — именованные
          регионы с заголовками, поэтому навигация по ним остаётся понятной. */}
      <div className="dash-cols">
        <div className="dash-main">
          <div className="order-1">
            {goalDone ? (
              <GoalDoneHero
                xpToday={goal.xpToday}
                xpGoal={goal.xpGoal}
                streakLine={streakExtendedLine(streak.state, streak.value)}
                summary={props.summary}
              />
            ) : (
              <DashboardHero {...props.hero} eyebrow={heroEyebrow} />
            )}
          </div>

          <div className="dash-tiles order-2">
            <GoalTile goal={goal} />
            <DueTile dueCount={props.dueCount} />
          </div>

          {props.firstSteps && (
            <div className="order-3">
              <FirstStepsCard state={props.firstSteps} />
            </div>
          )}

          {goalDone && props.wantMore.length > 0 && (
            <div className="order-3">
              <WantMore items={props.wantMore} />
            </div>
          )}

          <div className="order-5">
            <ContinueSection
              reading={props.continueReading}
              isVideo={props.continueIsVideo}
              showReading={!(goalDone && props.continueReading)}
              path={props.path}
              showPathInvite={props.showPathInvite}
              lastActivity={props.lastActivity}
            />
          </div>

          <div className="order-8">
            <QuickActions />
          </div>
        </div>

        <div className="dash-aside">
          <div className="order-4">
            <WeekCard
              marks={props.week}
              todayIndex={props.todayColumn}
              note={weekNote({ streakState: streak.state, streakLongest: streak.longest })}
            />
          </div>

          {props.questsCard && <div className="order-6 empty:hidden">{props.questsCard}</div>}

          {props.pendingRecommendationsCount > 0 && (
            <div className="order-7">
              <RecommendationsLink count={props.pendingRecommendationsCount} />
            </div>
          )}

          {props.topPatterns.length > 0 && (
            <div className="order-7">
              <MyEnglishCard patterns={props.topPatterns} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
