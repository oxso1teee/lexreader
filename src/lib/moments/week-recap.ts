import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isoWeekStart } from "@/lib/iso-week";
import type { WeekRecapMoment } from "./types";

const MONTH_NAMES_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function weekLabel(start: Date, end: Date): string {
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = `${start.getUTCDate()}${sameMonth ? "" : ` ${MONTH_NAMES_SHORT[start.getUTCMonth()]}`}`;
  return `${startLabel}–${end.getUTCDate()} ${MONTH_NAMES_SHORT[end.getUTCMonth()]}`;
}

// docs/moments/ROADMAP.md, этап 7 — Week-recap, по понедельникам. Строит
// момент из реальных чисел прошлой ISO-недели (пн..вс), без заглушек:
// новые слова (vocabulary_items.created_at), минуты чтения
// (reading_sessions), дни без пропуска (activity_days.xp > 0), слово
// недели — максимум записей review_log среди слов, добавленных на этой
// или прошлой неделе (простая честная эвристика "больше всего видел").
export async function buildWeekRecapMoment(
  supabase: SupabaseServerClient,
  userId: string,
  language: string,
  now: Date,
): Promise<WeekRecapMoment | null> {
  const thisWeekStart = isoWeekStart(now);
  const weekStart = new Date(thisWeekStart.getTime() - 7 * 86_400_000);
  const weekEnd = thisWeekStart; // эксклюзивно
  const weekEndDisplay = new Date(weekEnd.getTime() - 86_400_000);

  const [{ data: newWordRows }, { data: sessions }, { data: activityRows }] = await Promise.all([
    supabase
      .from("vocabulary_items")
      .select("id, headword, translation, context_sentence, status, created_at, flashcard_id")
      .eq("owner_id", userId)
      .eq("language", language)
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString()),
    supabase
      .from("reading_sessions")
      .select("started_at, ended_at, text_id")
      .eq("owner_id", userId)
      .gte("started_at", weekStart.toISOString())
      .lt("started_at", weekEnd.toISOString()),
    supabase
      .from("activity_days")
      .select("day, xp")
      .eq("user_id", userId)
      .gte("day", weekStart.toISOString().slice(0, 10))
      .lt("day", weekEnd.toISOString().slice(0, 10)),
  ]);

  const newWords = newWordRows ?? [];
  if (newWords.length === 0 && (sessions ?? []).length === 0 && (activityRows ?? []).filter((a) => a.xp > 0).length === 0) {
    // Совсем нечего показывать — честный пустой экран хуже, чем его
    // отсутствие; гейт просто не покажет ничего на этой неделе.
    return null;
  }

  const minutesRead = (sessions ?? []).reduce((sum, s) => {
    const ms = new Date(s.ended_at ?? s.started_at).getTime() - new Date(s.started_at).getTime();
    return sum + Math.max(0, Math.round(ms / 60_000));
  }, 0);
  const chaptersRead = new Set((sessions ?? []).map((s) => s.text_id)).size;
  const activeDays = (activityRows ?? []).filter((a) => a.xp > 0).length;
  const alreadyKnownCount = newWords.filter((w) => w.status === "known").length;

  let wordOfWeek: WeekRecapMoment["wordOfWeek"] = null;
  const flashcardIds = newWords.map((w) => w.flashcard_id).filter((id): id is string => Boolean(id));
  if (flashcardIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from("review_log")
      .select("grade, flashcard_id")
      .in("flashcard_id", flashcardIds)
      .gte("reviewed_at", weekStart.toISOString())
      .lt("reviewed_at", weekEnd.toISOString());
    const counts = new Map<string, { seen: number; correct: number }>();
    for (const r of reviewRows ?? []) {
      const c = counts.get(r.flashcard_id) ?? { seen: 0, correct: 0 };
      c.seen++;
      if (r.grade >= 2) c.correct++;
      counts.set(r.flashcard_id, c);
    }
    let best: { id: string; seen: number; correct: number } | null = null;
    for (const [id, c] of counts) {
      if (!best || c.seen > best.seen) best = { id, seen: c.seen, correct: c.correct };
    }
    if (best) {
      const word = newWords.find((w) => w.flashcard_id === best!.id);
      if (word) {
        wordOfWeek = {
          headword: word.headword,
          translation: word.translation,
          contextSentence: word.context_sentence,
          timesSeen: best.seen,
          timesCorrect: best.correct,
        };
      }
    }
  }

  return {
    kind: "week_recap",
    id: `week-recap-${userId}-${weekStart.toISOString().slice(0, 10)}`,
    weekLabel: weekLabel(weekStart, weekEndDisplay),
    newWordsCount: newWords.length,
    alreadyKnownCount,
    wordOfWeek,
    minutesRead,
    chaptersRead,
    activeDays,
  };
}
