-- docs/release-2026-08-22/07_TESTIROVANIE_I_CI.md section 1 / 02: the Stripe
-- webhook (src/app/api/webhooks/stripe/route.ts) had no defense against
-- redelivery of the same event.id — Stripe explicitly documents that
-- duplicate deliveries happen (network retries, infra hiccups) and expects
-- receivers to be idempotent. checkout.session.completed's upsert and the
-- other handlers' .update() calls happen to converge to the same final row
-- state on a second delivery, but that's incidental, not a real guarantee —
-- a redelivery still re-runs the handler body wholesale (extra Stripe API
-- calls, a second subscription_started analytics event double-counting one
-- real signup, and no protection at all against a future handler that adds
-- a genuinely non-idempotent side effect, e.g. granting bonus credits per
-- payment). event_id as the primary key is the source of truth for "have we
-- actually processed this exact event before".
create table processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Never exposed to authenticated/anon — same service_role-only model 0014
-- already established for translations_cache/translate_requests. The
-- webhook route is the only writer (createServiceClient()), and there's no
-- legitimate reason for any client-side code to ever read this table.
-- delete is required too, not just select/insert — route.ts rolls back its
-- own reservation row when processStripeEvent throws, so a real Stripe
-- retry for that event_id can actually reprocess it instead of silently
-- no-op'ing against a row nothing ever cleaned up.
alter table processed_stripe_events enable row level security;
grant select, insert, delete on processed_stripe_events to service_role;
