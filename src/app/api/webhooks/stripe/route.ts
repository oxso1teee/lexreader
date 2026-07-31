import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { PostHog } from "posthog-node";
import { getStripeClient, isStripeConfigured, planFromPriceId } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";

function capturePostHogEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
  client.capture({ distinctId, event, properties });
  void client.shutdown();
}

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
      capturePostHogEvent(ownerId, "subscription_started", { plan });
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

  return NextResponse.json({ received: true });
}
