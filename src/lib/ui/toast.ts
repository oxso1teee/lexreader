import { createToastStore, type ToastAction, type ToastInput, type ToastTone } from "./toast-store.ts";
import { getErrorMessage, type ActionResult } from "./errors.ts";

// Единственный экземпляр на вкладку: <Toaster> (components/ui/toast.tsx)
// подписан на него, а toast.* можно вызывать откуда угодно на клиенте —
// из обработчиков, server-action-колбэков, не только из React-компонентов.
export const toastStore = createToastStore();

type Options = Omit<ToastInput, "title" | "tone">;

function show(tone: ToastTone, title: string, options: Options = {}): string {
  return toastStore.add({ ...options, tone, title });
}

export const toast = {
  show: (input: ToastInput) => toastStore.add(input),
  success: (title: string, options?: Options) => show("success", title, options),
  error: (title: string, options?: Options) => show("error", title, options),
  warning: (title: string, options?: Options) => show("warning", title, options),
  info: (title: string, options?: Options) => show("info", title, options),
  /** Не закрывается сам; завершить через toast.success/error с тем же id или toast.update. */
  loading: (title: string, options?: Options) => show("loading", title, options),
  update: (id: string, patch: Partial<Omit<ToastInput, "id">>) => toastStore.update(id, patch),
  dismiss: (id?: string) => toastStore.dismiss(id),

  /** Ошибка из любого источника → toast с человекочитаемым текстом. */
  fromError(err: unknown, fallback?: string, options?: Options): string {
    return show("error", getErrorMessage(err, fallback), options);
  },

  /**
   * Результат server action в проектной форме { ok, error? }: успех — toast
   * success (если передан текст), ошибка — toast error с error из результата.
   */
  fromResult(result: ActionResult, messages: { success?: string; fallbackError?: string }): string | null {
    if (result.ok) return messages.success ? show("success", messages.success) : null;
    return show("error", getErrorMessage(result.error, messages.fallbackError));
  },

  /** loading → success/error для промиса; возвращает его результат дальше. */
  async promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((value: T) => string); error?: string },
  ): Promise<T> {
    const id = show("loading", messages.loading);
    try {
      const value = await promise;
      toastStore.update(id, {
        tone: "success",
        title: typeof messages.success === "function" ? messages.success(value) : messages.success,
      });
      return value;
    } catch (err) {
      toastStore.update(id, { tone: "error", title: getErrorMessage(err, messages.error) });
      throw err;
    }
  },
};

export type { ToastAction, ToastInput, ToastTone };
