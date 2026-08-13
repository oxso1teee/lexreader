// M3 Slice 10 (brief Phase C §17, task #278) — one-time backfill for the ~1000 flashcards that
// existed before migration 0041 introduced learning_state. Those rows all default to
// learning_state='new' (see migration comment) regardless of their real review history —
// this script replaces that flat default with the real, evidence-based value by calling the
// exact same recomputeAndPersistLearningState() used on every live review, never a separate
/// diverging backfill formula.
//
// Idempotent by construction: recomputeAndPersistLearningState always derives fresh from
// review_log/srs_state (same "never trust a stored flag" discipline as FSRS itself), so running
// this twice — or against a row it already reconciled — produces the same result each time.
// Historical review_log rows all have practice_mode=NULL (that column didn't exist yet), and the
// state engine already excludes null-mode reviews from both recall and recognition evidence
// (state-engine.ts) — so this backfill can only ever land a row on 'new', 'learning', or
// 'maintenance' (the interval/stability-only path), never 'familiar' or 'active'. That's the
// honest ceiling for evidence with no real practice-mode record, not a special case coded here.
//
// Usage:
//   node --experimental-strip-types scripts/reconcile-historical-learning-state.ts --dry-run
//   node --experimental-strip-types scripts/reconcile-historical-learning-state.ts
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment (loaded from
// .env.local below) — this bypasses RLS on purpose, the same way src/lib/supabase/service.ts's
// createServiceClient() is used by the existing push-reminders cron job, since it must see every
// user's flashcards, not just one signed-in user's.

import { createClient } from "@supabase/supabase-js";
import { recomputeAndPersistLearningState } from "../src/lib/vocabulary/state-update.ts";

process.loadEnvFile(".env.local");

const PAGE_SIZE = 500;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // learning_state_updated_at is NULL exactly for rows never touched by
  // recomputeAndPersistLearningState — set on every real recompute, left NULL by migration
  // 0041's flat default (see that migration's comment). That is the precise "needs
  // reconciliation" marker; learning_state_version is not usable for this since it defaults to
  // 1 for every row regardless of whether it's been recomputed.
  const { count: totalCandidates, error: countError } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .is("learning_state_updated_at", null);
  if (countError) throw new Error(`Failed to count candidates: ${countError.message}`);

  console.log(`Found ${totalCandidates ?? 0} flashcard(s) with no recorded learning_state recompute.`);
  if (dryRun) console.log("--dry-run: no writes will be made.\n");

  const before = new Map<string, string>();
  let processed = 0;
  const after = { new: 0, learning: 0, familiar: 0, active: 0, maintenance: 0 };

  for (;;) {
    const { data: rows, error } = await supabase
      .from("flashcards")
      .select("id, learning_state")
      .is("learning_state_updated_at", null)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (error) throw new Error(`Failed to fetch page: ${error.message}`);
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      before.set(row.id, row.learning_state);
      if (!dryRun) {
        await recomputeAndPersistLearningState(supabase, row.id);
      }
      processed += 1;
    }

    if (dryRun) break; // nothing changes learning_state_updated_at, so the query would repeat forever
    if (processed % 500 === 0) console.log(`  ...${processed} processed`);
  }

  if (dryRun) {
    console.log(`Would process ${processed} row(s) (values not computed — dry-run only counts candidates).`);
    return;
  }

  const { data: finalRows, error: finalError } = await supabase
    .from("flashcards")
    .select("id, learning_state")
    .in("id", [...before.keys()]);
  if (finalError) throw new Error(`Failed to fetch final state: ${finalError.message}`);
  for (const row of finalRows ?? []) {
    after[row.learning_state as keyof typeof after] += 1;
  }

  console.log(`\nReconciled ${processed} row(s).`);
  console.log("Resulting learning_state distribution:", after);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
