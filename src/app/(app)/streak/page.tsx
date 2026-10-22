import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { cardClassName } from "@/components/ui/card";
import { STREAK_MILESTONES } from "@/lib/streak-engine";
import { isoWeekStart } from "@/lib/iso-week";

// docs/moments/mockups/Streak-calendar.dc.html, reference/Streak-calendar.png
// — этап 2 (docs/moments/ROADMAP.md). Карточка "До сундука «Две недели»" из
// макета убрана — у приложения нет механики сундуков по рубежам серии
// (Chest появится в этапе 5), нечего показать настоящего.

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
// Предложный падеж ("в октябре", не "в октябрь") — для подписи счётчика дней.
const MONTH_NAMES_PREPOSITIONAL = [
  "январе", "феврале", "марте", "апреле", "мае", "июне",
  "июле", "августе", "сентябре", "октябре", "ноябре", "декабре",
];
const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function parseMonthParam(m: string | undefined): Date {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthParam(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function StreakCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const monthStart = parseMonthParam(m);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const daysInMonth = monthEnd.getUTCDate();
  const todayIso = isoDate(new Date());
  const thisMonthIso = monthParam(new Date());
  const isCurrentMonth = monthParam(monthStart) === thisMonthIso;

  const { data: rows } = await supabase
    .from("activity_days")
    .select("day, xp, freeze_used")
    .eq("user_id", profile.id)
    .gte("day", isoDate(monthStart))
    .lte("day", isoDate(monthEnd));

  const byDay = new Map((rows ?? []).map((r) => [r.day as string, r]));
  const activeDaysThisMonth = (rows ?? []).filter((r) => (r.xp as number) > 0).length;

  // Пн..Вс раскладка: смещение первого дня месяца от понедельника (0..6).
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const cells: { label: string; day: string | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ label: "", day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const day = isoDate(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d)));
    cells.push({ label: String(d), day });
  }
  while (cells.length % 7 !== 0) cells.push({ label: "", day: null });

  const thisWeekStart = isoDate(isoWeekStart(new Date()));
  const freezeUsedThisWeek = profile.streak_freeze_week === thisWeekStart && !profile.streak_freeze_available;
  // docs/moments/ROADMAP.md, этап 7 — Streak-commit: если пользователь
  // взял на себя обязательство (streak_goal_days) и ещё не выполнил его,
  // оно подсвечивается как "твоя цель" раньше следующей фиксированной
  // вехи STREAK_MILESTONES (которые остаются неизменной шкалой наград).
  const nextFixedMilestone = STREAK_MILESTONES.find((ms) => ms > profile.streak_current) ?? null;
  const ownGoalPending = profile.streak_goal_days && profile.streak_goal_days > profile.streak_current;
  const nextMilestone = ownGoalPending ? profile.streak_goal_days : nextFixedMilestone;
  const prevMilestone = [...STREAK_MILESTONES].reverse().find((ms) => ms <= profile.streak_current) ?? 0;
  const milestoneProgress = nextMilestone
    ? Math.min(1, (profile.streak_current - prevMilestone) / (nextMilestone - prevMilestone))
    : 1;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-8 pt-4">
      <div className="flex items-center">
        <Link href="/home" aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground hover:bg-[var(--surface-muted)]">
          <ChevronLeft aria-hidden="true" className="h-6 w-6" />
        </Link>
        <h1 className="font-display flex-1 text-center text-lg font-bold" style={{ marginRight: 44 }}>
          Стрик
        </h1>
      </div>

      <div
        className="flex items-center gap-3.5 rounded-3xl px-5 py-4.5"
        style={{ background: "var(--ember)", boxShadow: "inset 0 -6px 0 0 var(--ember-edge)", color: "#1a1a1a" }}
      >
        <div className="flex-1">
          <div className="font-display text-[44px] font-black leading-none">{profile.streak_current}</div>
          <div className="mt-1 text-base font-bold">дней подряд</div>
        </div>
        <svg viewBox="0 0 24 24" width="86" height="86" aria-hidden="true">
          <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="#fff" />
          <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
        </svg>
      </div>

      <div className={cardClassName({ className: "flex" })}>
        <div className="flex-1 p-3 text-center">
          <div className="font-display text-xl font-black" style={{ color: "var(--ember-text)" }}>
            {profile.streak_longest}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">рекорд</div>
        </div>
        <div className="w-0.5 bg-[var(--border-strong)]" />
        <div className="flex-1 p-3 text-center">
          <div className="font-display text-xl font-black" style={{ color: "var(--sky-text)" }}>
            {freezeUsedThisWeek ? "1 / 1" : "0 / 1"}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">заморозок</div>
        </div>
        <div className="w-0.5 bg-[var(--border-strong)]" />
        <div className="flex-1 p-3 text-center">
          <div className="font-display text-xl font-black" style={{ color: "var(--color-forest-text)" }}>
            {activeDaysThisMonth}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">дней в {MONTH_NAMES_PREPOSITIONAL[monthStart.getUTCMonth()]}</div>
        </div>
      </div>

      <div className={cardClassName({ className: "p-3 pb-3.5" })}>
        <div className="flex items-center justify-between">
          <Link
            href={`/streak?m=${monthParam(addMonths(monthStart, -1))}`}
            aria-label="Предыдущий месяц"
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-muted)]"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <div className="text-base font-bold">
            {MONTH_NAMES[monthStart.getUTCMonth()]} {monthStart.getUTCFullYear()}
          </div>
          {isCurrentMonth ? (
            <span className="flex h-11 w-11 items-center justify-center text-[var(--border-strong)]">
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </span>
          ) : (
            <Link
              href={`/streak?m=${monthParam(addMonths(monthStart, 1))}`}
              aria-label="Следующий месяц"
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-muted)]"
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          )}
        </div>
        <div className="my-1 grid text-center text-xs font-bold text-[var(--text-secondary)]" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {WEEKDAY_HEADERS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          role="img"
          aria-label={`Календарь: ${activeDaysThisMonth} дней занятий в ${MONTH_NAMES_PREPOSITIONAL[monthStart.getUTCMonth()]}, текущая серия ${profile.streak_current} дней`}
        >
          {cells.map((c, i) => {
            const row = c.day ? byDay.get(c.day) : null;
            const active = row && (row.xp as number) > 0;
            const frozen = row?.freeze_used;
            const isToday = c.day === todayIso;
            return (
              <div key={i} className="flex h-10 items-center justify-center text-sm font-bold">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${isToday ? "mo-stepring" : ""}`}
                  style={{
                    background: frozen ? "var(--sky)" : active ? "var(--ember)" : undefined,
                    // Белый на --ember/--sky даёт только 2.2:1/2.4:1 (axe-core,
                    // e2e/unified-shell-a11y.spec.ts нашёл тот же класс проблемы
                    // в .td-hero выше) — тёмный текст тут же даёт 7.9:1/7.1:1,
                    // не var(--foreground): в тёмной теме он сам становится
                    // светлым, а заливка остаётся такой же яркой.
                    color: frozen || active ? "#1a1a1a" : isToday ? "var(--ember-text)" : "var(--text-secondary)",
                    border: isToday && !frozen && !active ? "2px dashed var(--ember)" : undefined,
                  }}
                >
                  {c.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2.5 flex justify-center gap-3.5 text-xs font-semibold text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <i className="block h-3 w-3 rounded-full" style={{ background: "var(--ember)" }} />
            занимался
          </span>
          <span className="flex items-center gap-1.5">
            <i className="block h-3 w-3 rounded-full" style={{ background: "var(--sky)" }} />
            заморозка
          </span>
        </div>
      </div>

      {nextMilestone && (
        <div className={cardClassName({ className: "p-3.5" })}>
          <div className="flex justify-between text-sm font-bold">
            <span>{ownGoalPending ? `До твоей цели · ${nextMilestone} дней` : `До рубежа ${nextMilestone} дней`}</span>
            <span style={{ color: "var(--ember-text)" }}>
              {profile.streak_current}/{nextMilestone}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full rounded-full" style={{ width: `${milestoneProgress * 100}%`, background: "var(--ember)" }} />
          </div>
          <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
            Остал{nextMilestone - profile.streak_current === 1 ? "ся 1 день" : `ось ${nextMilestone - profile.streak_current} ${daysWordRu(nextMilestone - profile.streak_current)}`}
          </div>
        </div>
      )}
    </div>
  );
}

function daysWordRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}
