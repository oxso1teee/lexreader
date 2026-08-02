// P0-АУДИТ 3.23: раньше это было продублировано в двух файлах и молча
// откатывалось на localhost:3000 в проде, если NEXT_PUBLIC_SITE_URL пропадёт
// из переменных окружения — письма сброса пароля и редиректы Stripe после
// оплаты тихо указывали бы на localhost, без единой ошибки где-либо. Теперь
// в проде явно падаем (попадёт в логи/error boundary), а не портим ссылки
// молча; в деве по-прежнему удобный дефолт на localhost.
//
// UNIFIED-UI-SLICE-1: Vercel Preview деплои намеренно не получают
// NEXT_PUBLIC_SITE_URL (это домен продакшена — зашивать его в письма сброса
// пароля/Stripe-редиректы preview-сборки было бы неправильно, ссылка увела бы
// на прод). VERCEL_URL — системная переменная, которую Vercel сам прокидывает
// в рантайм КАЖДОГО деплоя (preview и production) без какой-либо настройки в
// дашборде — используем её как safe-фоллбэк вместо падения на Preview.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL/VERCEL_URL не заданы в продакшене — проверь переменные окружения Vercel.");
  }
  return "http://localhost:3000";
}
