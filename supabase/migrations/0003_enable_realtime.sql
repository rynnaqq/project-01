-- =============================================================================
-- Interactive Arcade Hub — Enable Realtime (P2.2)
-- Add the room/roster/match tables to the supabase_realtime publication so
-- clients receive INSERT/UPDATE/DELETE change events. REPLICA IDENTITY FULL
-- ensures DELETE payloads include the old row (needed to remove players).
-- =============================================================================

alter table public.rooms        replica identity full;
alter table public.room_players replica identity full;
alter table public.matches      replica identity full;
alter table public.scores       replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- rooms
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
    ) then
      alter publication supabase_realtime add table public.rooms;
    end if;
    -- room_players
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_players'
    ) then
      alter publication supabase_realtime add table public.room_players;
    end if;
    -- matches
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
    ) then
      alter publication supabase_realtime add table public.matches;
    end if;
    -- scores
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scores'
    ) then
      alter publication supabase_realtime add table public.scores;
    end if;
  end if;
end$$;
