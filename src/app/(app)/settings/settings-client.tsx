"use client";

import { useState } from "react";
import Link from "next/link";
import { savePushSubscription, deletePushSubscription, sendTestPush } from "./actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export default function SettingsClient({
  targetLanguage,
  nativeLanguage,
  level,
  dailyWordGoal,
  plan,
  initialPushEnabled,
}: {
  targetLanguage: string;
  nativeLanguage: string;
  level: string | null;
  dailyWordGoal: number;
  plan: string;
  initialPushEnabled: boolean;
}) {
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const pushSupported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  async function enablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Разрешение на уведомления не выдано.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Push не настроен на сервере.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setPushEnabled(true);
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Не удалось включить уведомления.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Не удалось отключить уведомления.");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestPush() {
    setTestResult(null);
    const result = await sendTestPush();
    setTestResult(result.ok ? "Отправлено — проверь уведомления." : (result.error ?? "Ошибка"));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Профиль</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-black/50 dark:text-white/50">Изучаю</dt>
          <dd>{targetLanguage}</dd>
          <dt className="text-black/50 dark:text-white/50">Родной язык</dt>
          <dd>{nativeLanguage}</dd>
          <dt className="text-black/50 dark:text-white/50">Уровень</dt>
          <dd>{level ?? "—"}</dd>
          <dt className="text-black/50 dark:text-white/50">Цель в день</dt>
          <dd>{dailyWordGoal} слов</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Подписка</h2>
        <p className="mb-3 text-sm text-black/60 dark:text-white/60">
          Текущий тариф: {plan === "free" ? "бесплатный" : plan === "premium_monthly" ? "Premium (месяц)" : "Premium (год)"}
        </p>
        <Link
          href="/paywall"
          className="text-sm text-black underline dark:text-white"
        >
          Управление подпиской
        </Link>
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Уведомления</h2>
        {!pushSupported ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Этот браузер не поддерживает push-уведомления.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-black/60 dark:text-white/60">
              Напоминание о повторении слов, когда накопится очередь.
            </p>
            {pushError && <p className="text-sm text-red-600 dark:text-red-400">{pushError}</p>}
            {!pushEnabled ? (
              <button
                type="button"
                disabled={pushBusy}
                onClick={enablePush}
                className="self-start rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {pushBusy ? "…" : "Включить напоминания"}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={disablePush}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/15"
                >
                  Отключить
                </button>
                <button
                  type="button"
                  onClick={handleTestPush}
                  className="text-sm text-black/60 underline dark:text-white/60"
                >
                  Тестовое уведомление
                </button>
              </div>
            )}
            {testResult && <p className="text-sm text-black/60 dark:text-white/60">{testResult}</p>}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Данные</h2>
        <a
          href="/api/export/vocabulary"
          download
          className="text-sm text-black underline dark:text-white"
        >
          Экспортировать словарь в CSV
        </a>
      </section>
    </div>
  );
}
