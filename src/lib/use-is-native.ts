"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

// docs/release-2026-08-22/04_MOBILNAYA_STRATEGIYA_APP_STORE_GOOGLE_PLAY.md —
// подтверждено пользователем явно (AskUserQuestion): v1 нативной обёртки
// (Capacitor) прячет весь paywall/subscription UI целиком — ни StoreKit,
// ни Play Billing в этом проходе не подключаются, управление подпиской —
// только на сайте в браузере. Показ кнопки "Купить"/"Оформить", ведущей
// на внешнюю оплату (Stripe Checkout), внутри самого нативного WebView —
// прямое основание для отказа на ревью Apple (Guideline 3.1.1).
//
// useSyncExternalStore, а не useState+useEffect: платформа не меняется во
// время жизни вкладки, но getServerSnapshot должен вернуть false (на
// сервере window/Capacitor нет вообще) и ровно то же самое — на первом
// клиентском рендере при гидратации, иначе React ругается на mismatch.
// React сам досинхронизирует до реального getSnapshot сразу после
// гидратации — то есть в нативной обёртке кнопка покупки не успевает
// мелькнуть даже на один кадр.
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return Capacitor.isNativePlatform();
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsNativePlatform(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
