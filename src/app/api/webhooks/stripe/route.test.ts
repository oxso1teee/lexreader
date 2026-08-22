import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// docs/release-2026-08-22/07_TESTIROVANIE_I_CI.md section 1 / 02: the Stripe
// webhook had no defense against redelivery of the same event.id. Fixed via
// supabase/migrations/0046_processed_stripe_events.sql (event_id primary
// key — a plain INSERT is a fully atomic idempotency check) plus route.ts
// checking/reserving it before running any business logic.
//
// route.ts imports via "@/..." aliases, which only resolve inside a real
// Next.js runtime (Node's own module resolution has no such alias — none
// of this repo's other node:test files actually exercise a "@/" import at
// runtime, only inside type-only positions that --experimental-strip-types
// erases). Testing it for real therefore means a real HTTP request against
// a real running Next.js server, not a direct function import.
//
// That server is spawned here on its own port with its own env, separate
// from the shared dev/e2e server on :3000 — setting a (fake) STRIPE_SECRET_KEY
// there would flip isStripeConfigured() globally and break
// payment.spec.ts's "local dev fallback works without Stripe keys" test,
// which explicitly relies on Stripe *not* being configured in this
// environment. The fake keys below are local-only HMAC signing material —
// stripe.webhooks.generateTestHeaderString()/constructEvent() never touch
// the network, so no real Stripe account is needed to test this.

const PORT = 3947;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const FAKE_STRIPE_SECRET_KEY = "sk_test_fake_for_webhook_idempotency_test";
const FAKE_STRIPE_WEBHOOK_SECRET = "whsec_fake_for_webhook_idempotency_test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(projectRoot, ".env.local");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function serviceClient() {
  const env = loadEnvLocal();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

// Straight through psql, not supabase-js's PostgREST client — the same
// fix e2e/account-delete-export.spec.ts needed: PostgREST/fetch has been
// observed serving a stale cached row count for data psql could already
// see committed at the same moment. Direct psql has no such cache.
function psql(sql: string): string {
  return execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
  }).trim();
}

function countProcessedEvents(eventId: string): number {
  return Number(psql(`select count(*) from processed_stripe_events where event_id = '${eventId}';`));
}

function subscriptionStatus(ownerId: string): string {
  return psql(`select status from subscriptions where owner_id = '${ownerId}';`);
}

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, { method: "POST" });
      // Any response at all (even the expected 400 for a bodiless/unsigned
      // POST) means the server is up and this route is reachable.
      if (res.status) return;
    } catch {
      // Not up yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server on :${PORT} never became ready within ${timeoutMs}ms`);
}

function signedRequestInit(event: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  const payload = JSON.stringify({
    id: event.id,
    object: "event",
    type: event.type,
    data: { object: event.data.object },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: FAKE_STRIPE_WEBHOOK_SECRET });
  return {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  };
}

describe("Stripe webhook idempotency", () => {
  let server: ChildProcess;
  const serverLogs: string[] = [];

  before(async () => {
    // Defensive: reap anything already bound to PORT from a previous run
    // that got killed uncleanly (e.g. a CI timeout) before it could run its
    // own after() — this is exactly the failure mode that produced stale,
    // pre-fix results while writing this test. Never fatal if nothing's
    // there.
    try {
      execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" });
    } catch {
      // Either nothing was listening, or `fuser` isn't installed — either
      // way, proceed; waitForServer() below will fail loudly if the port
      // is genuinely still stuck.
    }

    // Invoke the `next` binary directly (not via npx) and detached, in its
    // own process group — `next start` forks an actual `next-server` child
    // that survives a plain kill() on the immediate child (confirmed by
    // hand: an earlier hung run's orphaned next-server outlived pkill by
    // command-line pattern and kept answering on :3947 with stale, pre-fix
    // code for every run after it, silently). Killing the whole group via
    // process.kill(-pid) below is what actually reaps it.
    server = spawn(path.join(projectRoot, "node_modules/.bin/next"), ["start", "-p", String(PORT)], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...loadEnvLocal(),
        STRIPE_SECRET_KEY: FAKE_STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: FAKE_STRIPE_WEBHOOK_SECRET,
      },
      stdio: "pipe",
      detached: true,
    });
    server.stdout?.on("data", (d) => serverLogs.push(String(d)));
    server.stderr?.on("data", (d) => serverLogs.push(String(d)));
    try {
      await waitForServer();
    } catch (e) {
      throw new Error(`${(e as Error).message}\n--- server output ---\n${serverLogs.join("")}`);
    }
  });

  after(() => {
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {
        server.kill("SIGKILL");
      }
    }
  });

  test("redelivering the same event.id is a safe no-op, not a double-processed event", async (t) => {
    const supabase = serviceClient();

    // A real profile row is required (subscriptions.owner_id FKs to
    // profiles) — reuse the shared e2e test account rather than
    // provisioning a whole new auth user just for this.
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
    const testUser = users?.users.find((u) => u.email === "test@example.com");
    assert.ok(testUser, "test@example.com not found — run the e2e suite at least once first (global-setup.ts creates it)");
    const ownerId = testUser.id;
    const customerId = `cus_e2e_dedupe_${Date.now()}`;
    const eventId = `evt_e2e_dedupe_${Date.now()}`;

    await supabase.from("subscriptions").upsert({
      owner_id: ownerId,
      plan: "premium_monthly",
      status: "active",
      provider: "stripe",
      stripe_customer_id: customerId,
    });

    t.after(async () => {
      await supabase.from("subscriptions").update({ status: "canceled", stripe_customer_id: null }).eq("owner_id", ownerId);
      await supabase.from("processed_stripe_events").delete().eq("event_id", eventId);
    });

    const requestInit = signedRequestInit({
      id: eventId,
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_e2e_dedupe", customer: customerId } },
    });

    // --- First delivery: processes for real. ---
    const first = await fetch(`${BASE_URL}/api/webhooks/stripe`, requestInit);
    const firstText = await first.text();
    assert.equal(first.status, 200, `first delivery should succeed: ${firstText}`);
    assert.equal(subscriptionStatus(ownerId), "canceled", "first delivery should have applied customer.subscription.deleted");
    assert.equal(countProcessedEvents(eventId), 1, "first delivery should record exactly one processed_stripe_events row");

    // Flip the row to a state the handler would never produce on its own —
    // if redelivery actually re-ran processStripeEvent, this would flip
    // back to "canceled" again. Its survival is the real proof the second
    // delivery didn't re-execute the handler, not just that the end state
    // happens to look the same either way.
    await supabase.from("subscriptions").update({ status: "active" }).eq("owner_id", ownerId);

    // --- Second delivery: the exact same event.id again. ---
    const second = await fetch(`${BASE_URL}/api/webhooks/stripe`, requestInit);
    const secondText = await second.text();
    assert.equal(second.status, 200, `redelivery must still return 200 or Stripe retries forever: ${secondText}`);
    const secondBody = JSON.parse(secondText);
    assert.equal(secondBody.duplicate, true);

    assert.equal(
      subscriptionStatus(ownerId),
      "active",
      "redelivery must not re-run the handler — status should still be the value set right before it, not flipped back to canceled",
    );
    assert.equal(countProcessedEvents(eventId), 1, "redelivery must not create a second processed_stripe_events row");
  });

  test("a genuinely failed delivery does not poison the event_id for a real retry", async (t) => {
    const supabase = serviceClient();
    const eventId = `evt_e2e_dedupe_failure_${Date.now()}`;

    t.after(async () => {
      await supabase.from("processed_stripe_events").delete().eq("event_id", eventId);
    });

    // checkout.session.completed with a subscription id calls
    // stripe.subscriptions.retrieve() against the real Stripe API — with a
    // fake key that call genuinely fails, which is exactly the "handler
    // throws" case this test needs, without needing to fabricate a fault
    // any other way.
    const requestInit = signedRequestInit({
      id: eventId,
      type: "checkout.session.completed",
      data: { object: { id: "cs_e2e_fail", client_reference_id: "00000000-0000-0000-0000-000000000000", subscription: "sub_does_not_exist" } },
    });

    const first = await fetch(`${BASE_URL}/api/webhooks/stripe`, requestInit);
    assert.equal(first.status, 500, "a genuinely failing handler must return 500 so Stripe retries");
    assert.equal(
      countProcessedEvents(eventId),
      0,
      "a failed delivery must roll back its reservation — otherwise a real Stripe retry for this event_id would hit the dedupe check and silently no-op forever",
    );
  });
});
