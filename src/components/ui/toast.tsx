"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast, toastStore } from "@/lib/ui/toast";
import { type ToastItem, type ToastTone } from "@/lib/ui/toast-store";
import { useOnlineStatus } from "@/lib/ui/use-online-status";
import { Spinner } from "./skeleton";

// <Toaster /> монтируется ОДИН раз в корневом layout. Показывать toast —
// из любого клиентского кода: import { toast } from "@/lib/ui/toast".
//
// Доступность: регион role="region" с именем; ошибки и предупреждения —
// role="alert" (читаются сразу), остальные — role="status" (вежливо).
// Автозакрытие приостанавливается, пока на toast наведён курсор или в нём
// фокус (WCAG 2.2.1: у пользователя есть время прочитать и нажать действие).
const EMPTY: readonly ToastItem[] = [];

const ICONS: Record<Exclude<ToastTone, "loading">, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastView({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !Number.isFinite(item.duration)) return;
    const timer = setTimeout(() => toastStore.dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
    // revision: повторный show/update с тем же id перезапускает отсчёт.
  }, [paused, item.id, item.duration, item.revision]);

  const Icon = item.tone === "loading" ? null : ICONS[item.tone];
  const urgent = item.tone === "error" || item.tone === "warning";

  return (
    <div
      role={urgent ? "alert" : "status"}
      className={`toast toast-${item.tone}`}
      data-tone={item.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {Icon ? <Icon aria-hidden="true" className="toast-icon" /> : <Spinner size="sm" className="toast-icon" />}
      <div className="min-w-0 flex-1">
        {item.title}
        {item.description && <span className="toast-description">{item.description}</span>}
      </div>
      {item.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            item.action?.onClick();
            toastStore.dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      {item.dismissible && (
        <button type="button" className="toast-close" aria-label="Закрыть уведомление" onClick={() => toastStore.dismiss(item.id)}>
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Состояние сети → toast. Один постоянный id: «Нет соединения» висит, пока
// сети нет, и заменяется на «Снова онлайн», а не копится стопкой.
const CONNECTIVITY_ID = "connectivity";

function ConnectivityWatcher() {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      toast.show({
        id: CONNECTIVITY_ID,
        tone: "warning",
        title: "Нет соединения",
        description: "Прогресс сохранится на устройстве и отправится, когда связь вернётся.",
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
      });
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.show({ id: CONNECTIVITY_ID, tone: "success", title: "Снова онлайн" });
    }
  }, [online]);

  return null;
}

export function Toaster() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => EMPTY);
  return (
    <>
      <ConnectivityWatcher />
      <div className="toast-region" role="region" aria-label="Уведомления">
        {items.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

