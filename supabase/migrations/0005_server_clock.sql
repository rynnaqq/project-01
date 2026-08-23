-- =============================================================================
-- Interactive Arcade Hub — Server clock (P4.1)
-- Exposes the database's current time (epoch milliseconds) so clients can
-- correct for local clock skew when computing synced game countdowns.
-- =============================================================================

create or replace function public.server_now()
returns bigint
language sql
stable
as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

grant execute on function public.server_now() to anon, authenticated;
