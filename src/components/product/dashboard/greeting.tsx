"use client";

import { useSyncExternalStore } from "react";
import { greetingForHour } from "@/lib/today";

// Сервер не знает часовой пояс пользователя, а приветствие должно совпадать с
// его временем суток (на Vercel сервер живёт в UTC: «Добрый день» в 20:00 по
// Москве). Поэтому приветствие уточняется по часам браузера — тем же приёмом,
// что у TodayEveningGate: useSyncExternalStore с серверным снимком. На сервере
// и при первой клиентской отрисовке показывается приветствие, посчитанное
// сервером (hydration не расходится), следующим кадром оно заменяется
// локальным, дальше обновляется раз в минуту.
function subscribeMinute(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

export function Greeting({ serverGreeting, firstName }: { serverGreeting: string; firstName: string | null }) {
  const greeting = useSyncExternalStore(
    subscribeMinute,
    () => greetingForHour(new Date().getHours()),
    () => serverGreeting,
  );
  return (
    <h1 className="m-0 font-display text-[1.375rem] leading-[1.15] font-bold @3xl:text-[1.75rem]">
      {firstName ? `${greeting}, ${firstName}` : `${greeting}!`}
    </h1>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });

function currentDateLine(): string {
  const text = DATE_FORMAT.format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// «Четверг, 12 ноября» — по локальной дате браузера; на сервере пусто, чтобы
// не показать дату чужого часового пояса.
export function DateLine({ className }: { className?: string }) {
  const text = useSyncExternalStore(subscribeMinute, currentDateLine, () => "");
  return <p className={className}>{text}</p>;
}
