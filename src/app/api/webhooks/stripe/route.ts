import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured, planFromPriceId } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";
import { captureServerEvent, captureServerException } from "@/lib/posthog-server";

// Источник истины о статусе подписки — ТОЛЬКО эти вебхуки, никогда не
// доверять client-side редиректу "оплата прошла" (P0-PAY-01).
// Требует STRIPE_WEBHOOK_SECRET из Stripe Dashboard → Webhooks (владелец
// аккаунта настраивает endpoint на /api/webhooks/stripe после деплоя).

// P0-АУДИТ 3.7: раньше везде жёстко писали status: "active", игнорируя
// реальный статус подписки в Stripe (incomplete/trialing/unpaid и т.п.).
function mapStripeStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
}

export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json(
      { error: `Invalid signature: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // docs/release-2026-08-22/07_TESTIROVANIE_I_CI.md section 1 / 02: Stripe
  // guarantees occasional redelivery of the same event.id — a plain INSERT
  // into a table with event_id as its primary key is a fully atomic
  // idempotency check on its own (no advisory lock needed, unlike B.2's
  // sliding-window rate limit): under concurrent delivery of the same
  // event, exactly one INSERT wins the unique-constraint race and the other
  // gets a real 23505 error, deterministically, every time.
  const { error: dedupeError } = await supabase
    .from("processed_stripe_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (dedupeError) {
    if (dedupeError.code === "23505") {
      log.subscription({ kind: "duplicate_webhook_event", stripeEventType: event.type });
      // Must still return 200 — Stripe interprets anything else as "retry
      // this delivery again later", and it already succeeded the first time.
      return NextResponse.json({ received: true, duplicate: true });
    }
    captureServerException(dedupeError, undefined, { stripeEventType: event.type, context: "processed_stripe_events insert" });
    return NextResponse.json({ error: "Webhook dedupe check failed" }, { status: 500 });
  }

  try {
    await processStripeEvent(event, stripe, supabase);
  } catch (e) {
    // Roll back the reservation from above — this delivery attempt
    // genuinely failed, and the 500 below is about to make Stripe retry it.
    // Leaving the row in place would make that retry hit the dedupe check
    // and silently return 200 without ever actually reprocessing — turning
    // a transient failure into a permanently lost event instead of a safe
    // retry.
    const { error: rollbackError } = await supabase.from("processed_stripe_events").delete().eq("event_id", event.id);
    if (rollbackError) {
      // Genuinely worse than the original failure: the retry Stripe is
      // about to send will now silently no-op forever against a
      // reservation nothing cleaned up. Must not fail quietly.
      captureServerException(rollbackError, undefined, { stripeEventType: event.type, context: "processed_stripe_events rollback delete" });
    }
    captureServerException(e, undefined, { stripeEventType: event.type });
    // 500 — чтобы Stripe повторил доставку вебхука, а не решил, что мы его
    // успешно обработали, пока у нас в базе неконсистентное состояние.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function processStripeEvent(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: ReturnType<typeof createServiceClient>,
) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const ownerId = session.client_reference_id;
      if (!ownerId || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const plan = planFromPriceId(subscription.items.data[0]?.price.id);
      if (!plan) break;

      await supabase.from("subscriptions").upsert(
        {
          owner_id: ownerId,
          plan,
          status: mapStripeStatus(subscription.status),
          provider: "stripe",
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
        },
        { onConflict: "owner_id" },
      );
      log.subscription({ kind: "checkout_completed", ownerId, plan });
      captureServerEvent(ownerId, "subscription_started", { plan });
      break;
    }

    // P0-АУДИТ 3.6: смена плана через Customer Portal (месяц↔год, отложенная
    // отмена) шлёт именно это событие — раньше оно молча игнорировалось, и
    // план в базе оставался неверным до следующего invoice.paid.
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const plan = planFromPriceId(subscription.items.data[0]?.price.id);

      await supabase
        .from("subscriptions")
        .update({
          status: mapStripeStatus(subscription.status),
          ...(plan ? { plan } : {}),
          current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
        })
        .eq("stripe_customer_id", subscription.customer as string);
      log.subscription({ kind: "invoice_paid", plan: plan ?? undefined });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.parent?.subscription_details?.subscription;
      if (!subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
      const plan = planFromPriceId(subscription.items.data[0]?.price.id);

      await supabase
        .from("subscriptions")
        .update({
          status: mapStripeStatus(subscription.status),
          ...(plan ? { plan } : {}),
          current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
        })
        .eq("stripe_customer_id", subscription.customer as string);
      log.subscription({ kind: "invoice_paid", plan: plan ?? undefined });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string | null;
      if (!customerId) break;
      await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("stripe_customer_id", customerId);
      log.subscription({ kind: "payment_failed" });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_customer_id", subscription.customer as string);
      log.subscription({ kind: "canceled" });
      break;
    }
  }
}
