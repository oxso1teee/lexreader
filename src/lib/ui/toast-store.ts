// Хранилище toast-уведомлений: чистый TypeScript без React и таймеров, чтобы
// логику (дедупликация по id, лимит видимых, обновление «loading → success»)
// можно было проверить node:test. Таймеры автозакрытия живут в <Toaster>
// (src/components/ui/toast.tsx) — им нужна пауза при hover/focus.

export type ToastTone = "success" | "error" | "warning" | "info" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  /** Повторный show с тем же id обновляет существующий toast, а не дублирует его. */
  id?: string;
  tone?: ToastTone;
  title: string;
  description?: string;
  /** мс; Infinity — не закрывать автоматически. По умолчанию — по тону. */
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
}

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
  action?: ToastAction;
  dismissible: boolean;
  /** Растёт при каждом update — <Toaster> по нему перезапускает таймер. */
  revision: number;
}

/** Ошибки и предупреждения живут дольше: их нужно успеть прочитать. */
export const DEFAULT_TOAST_DURATION: Record<ToastTone, number> = {
  success: 3500,
  info: 4500,
  warning: 6500,
  error: 8000,
  loading: Number.POSITIVE_INFINITY,
};

export const MAX_VISIBLE_TOASTS = 4;

export interface ToastStore {
  add(input: ToastInput): string;
  update(id: string, patch: Partial<Omit<ToastInput, "id">>): void;
  dismiss(id?: string): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly ToastItem[];
}

export function createToastStore(options: { genId?: () => string } = {}): ToastStore {
  let counter = 0;
  const genId = options.genId ?? (() => `toast-${++counter}`);
  let items: readonly ToastItem[] = [];
  const listeners = new Set<() => void>();

  function commit(next: readonly ToastItem[]) {
    items = next;
    listeners.forEach((l) => l());
  }

  function build(input: ToastInput, id: string, revision: number): ToastItem {
    const tone = input.tone ?? "info";
    return {
      id,
      tone,
      title: input.title,
      description: input.description,
      duration: input.duration ?? DEFAULT_TOAST_DURATION[tone],
      action: input.action,
      dismissible: input.dismissible ?? true,
      revision,
    };
  }

  return {
    add(input) {
      const id = input.id ?? genId();
      const existing = items.find((t) => t.id === id);
      if (existing) {
        commit(items.map((t) => (t.id === id ? build(input, id, t.revision + 1) : t)));
        return id;
      }
      let next = [...items, build(input, id, 0)];
      // Лимит видимых: вытесняем самые старые, но sticky-уведомления
      // (loading/offline) переживают обычные.
      while (next.length > MAX_VISIBLE_TOASTS) {
        const victim = next.find((t) => Number.isFinite(t.duration)) ?? next[0];
        next = next.filter((t) => t !== victim);
      }
      commit(next);
      return id;
    },
    update(id, patch) {
      const existing = items.find((t) => t.id === id);
      if (!existing) return;
      const merged: ToastInput = {
        id,
        tone: patch.tone ?? existing.tone,
        title: patch.title ?? existing.title,
        description: "description" in patch ? patch.description : existing.description,
        // Смена тона без явной duration берёт дефолт нового тона
        // (loading → success должен закрыться, а не висеть вечно).
        duration: patch.duration ?? (patch.tone ? undefined : existing.duration),
        action: "action" in patch ? patch.action : existing.action,
        dismissible: patch.dismissible ?? existing.dismissible,
      };
      commit(items.map((t) => (t.id === id ? build(merged, id, t.revision + 1) : t)));
    },
    dismiss(id) {
      if (id === undefined) {
        if (items.length) commit([]);
        return;
      }
      if (items.some((t) => t.id === id)) commit(items.filter((t) => t.id !== id));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return items;
    },
  };
}
