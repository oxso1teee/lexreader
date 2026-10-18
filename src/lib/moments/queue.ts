import { MAX_MOMENTS_IN_A_ROW, MOMENT_PRIORITY, type Moment } from "./types.ts";

// Чистая логика очереди моментов — без React, чтобы покрыть тестами.
// Правила: один и тот же id не показываем дважды (ни в очереди, ни из уже
// показанных), порядок — по приоритету вида, при равенстве — по порядку
// прихода; за один «заход» не больше MAX_MOMENTS_IN_A_ROW экранов.

export interface MomentQueueState {
  pending: Moment[];
  seen: ReadonlySet<string>;
}

export function emptyQueue(seen: Iterable<string> = []): MomentQueueState {
  return { pending: [], seen: new Set(seen) };
}

export function enqueue(state: MomentQueueState, incoming: readonly Moment[]): MomentQueueState {
  const ids = new Set(state.pending.map((m) => m.id));
  const added: Moment[] = [];
  for (const m of incoming) {
    if (state.seen.has(m.id) || ids.has(m.id)) continue;
    ids.add(m.id);
    added.push(m);
  }
  if (added.length === 0) return state;
  const merged = [...state.pending, ...added];
  // Array.prototype.sort стабилен — равные приоритеты сохраняют порядок прихода.
  merged.sort((a, b) => MOMENT_PRIORITY[b.kind] - MOMENT_PRIORITY[a.kind]);
  return { pending: merged, seen: state.seen };
}

/** Что показывать прямо сейчас (не больше лимита). */
export function currentBatch(state: MomentQueueState): Moment[] {
  return state.pending.slice(0, MAX_MOMENTS_IN_A_ROW);
}

/** Пользователь закрыл экран: убираем его и запоминаем как показанный. */
export function dismiss(state: MomentQueueState, id: string): MomentQueueState {
  const seen = new Set(state.seen);
  seen.add(id);
  return { pending: state.pending.filter((m) => m.id !== id), seen };
}
