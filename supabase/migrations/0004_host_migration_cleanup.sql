-- =============================================================================
-- Interactive Arcade Hub — Host migration & stale room cleanup (P2.3)
-- =============================================================================

-- When a player leaves a room, keep the room consistent:
--   * if no players remain, delete the room (teardown);
--   * else if the leaver was the host, promote the earliest-joined remaining
--     member to host (host migration).
create or replace function public.handle_room_player_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_new_host uuid;
begin
  select count(*) into v_remaining
  from public.room_players
  where room_id = old.room_id;

  if v_remaining = 0 then
    delete from public.rooms where id = old.room_id;
    return old;
  end if;

  if exists (
    select 1 from public.rooms
    where id = old.room_id and host_id = old.player_id
  ) then
    select player_id into v_new_host
    from public.room_players
    where room_id = old.room_id
    order by joined_at asc
    limit 1;

    update public.rooms
    set host_id = v_new_host
    where id = old.room_id;
  end if;

  return old;
end;
$$;

drop trigger if exists on_room_player_left on public.room_players;
create trigger on_room_player_left
  after delete on public.room_players
  for each row execute function public.handle_room_player_left();

-- Delete abandoned rooms: those with no members, or older than the given age
-- while not actively playing. Intended to be scheduled (e.g. pg_cron) but also
-- callable on demand by an authenticated client.
create or replace function public.cleanup_stale_rooms(p_max_age_hours int default 6)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  with del as (
    delete from public.rooms r
    where not exists (
        select 1 from public.room_players rp where rp.room_id = r.id
      )
      or (
        r.status <> 'playing'
        and r.created_at < now() - make_interval(hours => p_max_age_hours)
      )
    returning r.id
  )
  select count(*) into v_deleted from del;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_stale_rooms(int) to authenticated;
