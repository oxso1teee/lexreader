// P0-АУДИТ 3.23: раньше это было продублировано в двух файлах и молча
// откатывалось на localhost:3000 в проде, если NEXT_PUBLIC_SITE_URL пропадёт
// из переменных окружения — письма сброса пароля и редиректы Stripe после
// оплаты тихо указывали бы на localhost, без единой ошибки где-либо. Теперь
// в проде явно падаем (попадёт в логи/error boundary), а не портим ссылки
// молча; в деве по-прежнему удобный дефолт на localhost.
export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL не задан в продакшене — проверь переменные окружения Vercel.");
  }
  return "http://localhost:3000";
}
