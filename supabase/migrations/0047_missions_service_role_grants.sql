-- 0037_missions.sql granted select/insert/update/delete on missions and
-- mission_attempts to `authenticated` only, never `service_role` — every
-- other table added since 0008_service_role_grants.sql gets that grant.
-- The app itself never noticed (its own code always uses the regular
-- session-scoped client for missions, never createServiceClient()), but it
-- silently broke any server-role script/test touching this table: a
-- service_role UPDATE/DELETE against missions returns no error from
-- supabase-js (permission-denied responses don't throw, callers must check
-- `.error` explicitly — matching the exact class of bug found and fixed in
-- 0046_processed_stripe_events.sql's own rollback delete) but simply
-- affects zero rows. Already flagged once before, in
-- e2e/today-crash-regression.spec.ts's own comment ("a pre-existing,
-- unrelated gap... rather than adding a new migration mid-incident-fix,
-- seed via a direct psql connection instead") — closing it for real here.
grant select, insert, update, delete on missions to service_role;
grant select, insert, update, delete on mission_attempts to service_role;
