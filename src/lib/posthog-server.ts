import { PostHog } from "posthog-node";

// posthog-node в serverless-окружении (Vercel functions) не должен жить
// между запросами — фоновый флаш может не успеть отработать до заморозки
// контейнера, поэтому клиент создаём на вызов и сразу gracefully закрываем.
function getClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const client = getClient();
  if (!client) return;
  client.capture({ distinctId, event, properties });
  void client.shutdown();
}

// Error tracking через PostHog вместо Sentry — см. docs/OBSERVABILITY.md:
// sentry.io отдаёт 403 на попытку регистрации из нашей сети, а PostHog уже
// подключён и его Error Tracking делает то же самое без нового аккаунта.
export function captureServerException(
  error: unknown,
  distinctId?: string,
  additionalProperties?: Record<string, unknown>,
) {
  const client = getClient();
  if (!client) return;
  client.captureException(error, distinctId, additionalProperties);
  void client.shutdown();
}
