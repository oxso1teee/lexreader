import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  ensureConfigured();
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
  );
}
