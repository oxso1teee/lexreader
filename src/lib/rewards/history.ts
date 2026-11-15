import type { SupabaseServerClient } from "../supabase/server.ts";
import { addDays } from "../user-day.ts";
import { sourceLabel } from "../xp/sources.ts";

// История XP для экрана наград — читается из журнала xp_events (миграция 0059):
// «за что и когда получено» без догадок. Журнал ведётся с Iteration 6, поэтому
// история начинается с него — старые начисления в журнал не переносились.

export interface XpHistoryEvent {
  id: string;
  source: string;
  label: string;
  /** Начислено (с Double-XP). */
  amount: number;
  boosted: boolean;
  day: string;
  createdAt: string;
}

export interface XpHistoryDay {
  day: string;
  total: number;
  events: XpHistoryEvent[];
}

interface EventRow {
  id: string;
  source: string;
  amount: number;
  boosted: boolean;
  day: string;
  created_at: string;
}

export function toHistoryEvent(row: EventRow): XpHistoryEvent {
  return {
    id: row.id,
    source: row.source,
    label: sourceLabel(row.source),
    amount: row.amount,
    boosted: row.boosted,
    day: row.day,
    createdAt: row.created_at,
  };
}

/** События (новые первыми) → дни по убыванию с суммой за день. Порядок внутри дня сохраняется. */
export function groupXpHistory(events: readonly XpHistoryEvent[]): XpHistoryDay[] {
  const days = new Map<string, XpHistoryDay>();
  for (const event of events) {
    const group = days.get(event.day) ?? { day: event.day, total: 0, events: [] };
    group.total += event.amount;
    group.events.push(event);
    days.set(event.day, group);
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** «Сегодня», «Вчера», «12 ноября» — относительно локального «сегодня» пользователя. */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "Сегодня";
  if (day === addDays(today, -1)) return "Вчера";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const month = MONTHS_GENITIVE[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month}` : day;
}

export const HISTORY_LIMIT = 40;

export async function loadXpHistory(supabase: SupabaseServerClient, userId: string, limit = HISTORY_LIMIT): Promise<XpHistoryDay[]> {
  const { data, error } = await supabase
    .from("xp_events")
    .select("id, source, amount, boosted, day, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`xp_events: ${error.message}`);
  return groupXpHistory(((data ?? []) as EventRow[]).map(toHistoryEvent));
}
