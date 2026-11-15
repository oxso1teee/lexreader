// Мелкие помощники для email на экранах входа: проверка формата, маска и
// ссылка «Открыть почту». Чистые функции без зависимостей — тестируются
// `node --experimental-strip-types --test`.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

/** Грубая проверка «похоже на email» — настоящая проверка адреса это письмо. */
export function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
}

/** s•••••@gmail.com — первая буква и фиксированное число точек (длину не раскрываем). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const first = Array.from(email.slice(0, at))[0];
  return `${first}•••••@${email.slice(at + 1)}`;
}

export interface MailProvider {
  name: string;
  url: string;
}

const PROVIDERS: { name: string; url: string; domains: readonly string[] }[] = [
  { name: "Gmail", url: "https://mail.google.com/", domains: ["gmail.com", "googlemail.com"] },
  {
    name: "Яндекс Почту",
    url: "https://mail.yandex.ru/",
    domains: ["yandex.ru", "yandex.com", "yandex.by", "yandex.kz", "yandex.ua", "ya.ru"],
  },
  {
    name: "Почту Mail.ru",
    url: "https://e.mail.ru/",
    domains: ["mail.ru", "inbox.ru", "list.ru", "bk.ru", "internet.ru"],
  },
  {
    name: "Outlook",
    url: "https://outlook.live.com/mail/",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
  },
  { name: "iCloud Почту", url: "https://www.icloud.com/mail", domains: ["icloud.com", "me.com", "mac.com"] },
  { name: "Proton Mail", url: "https://mail.proton.me/", domains: ["proton.me", "protonmail.com", "pm.me"] },
  { name: "Yahoo Почту", url: "https://mail.yahoo.com/", domains: ["yahoo.com", "ymail.com", "rocketmail.com"] },
  { name: "Рамблер Почту", url: "https://mail.rambler.ru/", domains: ["rambler.ru"] },
];

/** Веб-почта по домену адреса; null — домен неизвестен, кнопку не показываем. */
export function mailProviderFor(email: string): MailProvider | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  const provider = PROVIDERS.find((p) => p.domains.includes(domain));
  return provider ? { name: provider.name, url: provider.url } : null;
}
