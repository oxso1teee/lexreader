-- docs/release-2026-08-22/02_KRITICHNYE_BAGI_SEYCHAS.md B.2 — the 2026-07-23
-- fix (0014/route.ts) reordered to insert-then-count, which closed the worst
-- case (N concurrent requests all reading the same pre-burst count) but is
-- self-admittedly "не идеально атомарно": nothing stops a large concurrent
-- burst from each running its own SELECT before the others' INSERTs are
-- visible to it, letting the effective limit be exceeded under real
-- concurrency. This makes the whole check-then-increment one atomic unit.
--
-- Advisory lock, not a counter-column rewrite: translate_requests is a
-- sliding-window request log (owner_id, requested_at), and the existing
-- 60s-sliding-window / 1-hour-cleanup semantics in route.ts depend on that
-- per-request timestamp. A single UPSERT-with-counter would force a switch
-- to fixed time buckets and lose that. pg_advisory_xact_lock, scoped per
-- owner_id, serializes only concurrent calls for the *same* user (other
-- users' requests never block each other), is held only for this
-- transaction, and is released automatically on commit or rollback — no
-- lock-cleanup code needed.

create or replace function public.check_translate_rate_limit(
  p_owner_id uuid,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_owner_id is null then
    raise exception using errcode = '22023', message = 'owner_id is required';
  end if;
  if p_limit < 0 or p_window_seconds <= 0 then
    raise exception using errcode = '22023', message = 'invalid limit/window';
  end if;

  -- Two-key form namespaces this lock against any other advisory lock in the
  -- database (fixed hash of the table name as key1) so only concurrent calls
  -- to *this* function for the *same* owner_id (key2) ever contend.
  perform pg_advisory_xact_lock(hashtext('translate_requests'), hashtext(p_owner_id::text));

  insert into public.translate_requests (owner_id) values (p_owner_id);

  select count(*) into v_count
  from public.translate_requests
  where owner_id = p_owner_id
    and requested_at >= now() - make_interval(secs => p_window_seconds);

  -- Same 1% opportunistic cleanup route.ts used to do at the application
  -- level — global (not owner-scoped), unaffected by the per-owner lock
  -- above since it touches rows/locks outside that key.
  if random() < 0.01 then
    delete from public.translate_requests
    where requested_at < now() - interval '1 hour';
  end if;

  return v_count <= p_limit;
end;
$$;

-- Only ever called from the server via the service-role client (matching
-- 0014's "translations_cache/translate_requests: service_role only" model)
-- — never exposed to `authenticated`/`anon`, so no RLS bypass surface opens
-- up by adding this function.
revoke all on function public.check_translate_rate_limit(uuid, integer, integer) from public;
revoke all on function public.check_translate_rate_limit(uuid, integer, integer) from anon;
revoke all on function public.check_translate_rate_limit(uuid, integer, integer) from authenticated;
grant execute on function public.check_translate_rate_limit(uuid, integer, integer) to service_role;
