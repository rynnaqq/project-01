-- =============================================================================
-- Interactive Arcade Hub — Initial schema (P1.1)
-- Tables: profiles, rooms, room_players, matches, scores
-- Includes indexes, updated_at triggers, helper functions, and RLS policies.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'room_status') then
    create type public.room_status as enum ('waiting', 'ready', 'playing', 'finished');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique
                  check (char_length(username) between 3 and 20),
  avatar        text not null default 'avatar-01',
  badge         text,
  online_status boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (lower(username));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- rooms: a multiplayer game room
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.room_status not null default 'waiting',
  selected_game text,
  rules         jsonb not null default '{}'::jsonb,
  max_players   int not null default 8 check (max_players between 2 and 16),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists rooms_host_idx on public.rooms (host_id);
create index if not exists rooms_status_idx on public.rooms (status);
create index if not exists rooms_created_at_idx on public.rooms (created_at);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- room_players: membership of a room
-- ---------------------------------------------------------------------------
create table if not exists public.room_players (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  is_ready   boolean not null default false,
  joined_at  timestamptz not null default now(),
  unique (room_id, player_id)
);

create index if not exists room_players_room_idx on public.room_players (room_id);
create index if not exists room_players_player_idx on public.room_players (player_id);

-- ---------------------------------------------------------------------------
-- matches: a single played game within a room
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  game_key   text not null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  winner_id  uuid references public.profiles (id) on delete set null
);

create index if not exists matches_room_idx on public.matches (room_id);
create index if not exists matches_winner_idx on public.matches (winner_id);

-- ---------------------------------------------------------------------------
-- scores: per-player score for a match
-- ---------------------------------------------------------------------------
create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  score      int not null default 0,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists scores_match_idx on public.scores (match_id);
create index if not exists scores_player_idx on public.scores (player_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER) to avoid recursive RLS evaluation
-- ---------------------------------------------------------------------------
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room_id and rp.player_id = auth.uid()
  );
$$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_id = auth.uid()
  );
$$;

create or replace function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.matches m
    join public.room_players rp on rp.room_id = m.room_id
    where m.id = p_match_id and rp.player_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_players enable row level security;
alter table public.matches      enable row level security;
alter table public.scores       enable row level security;

-- profiles: readable by any authenticated user (needed for player lists);
-- users may insert/update only their own row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- rooms: any authenticated user may look up a room (to join by code);
-- only the host may create/update/delete their room.
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated
  using (true);

drop policy if exists rooms_insert_host on public.rooms;
create policy rooms_insert_host on public.rooms
  for insert to authenticated
  with check (host_id = auth.uid());

drop policy if exists rooms_update_host on public.rooms;
create policy rooms_update_host on public.rooms
  for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists rooms_delete_host on public.rooms;
create policy rooms_delete_host on public.rooms
  for delete to authenticated
  using (host_id = auth.uid());

-- room_players: members of a room can see its roster; a user may add/remove
-- themselves, and the host may remove anyone.
drop policy if exists room_players_select on public.room_players;
create policy room_players_select on public.room_players
  for select to authenticated
  using (player_id = auth.uid() or public.is_room_member(room_id));

drop policy if exists room_players_insert_self on public.room_players;
create policy room_players_insert_self on public.room_players
  for insert to authenticated
  with check (player_id = auth.uid());

drop policy if exists room_players_update_self on public.room_players;
create policy room_players_update_self on public.room_players
  for update to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

drop policy if exists room_players_delete_self_or_host on public.room_players;
create policy room_players_delete_self_or_host on public.room_players
  for delete to authenticated
  using (player_id = auth.uid() or public.is_room_host(room_id));

-- matches: visible to room members; only the host may create/update matches.
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists matches_insert_host on public.matches;
create policy matches_insert_host on public.matches
  for insert to authenticated
  with check (public.is_room_host(room_id));

drop policy if exists matches_update_host on public.matches;
create policy matches_update_host on public.matches
  for update to authenticated
  using (public.is_room_host(room_id))
  with check (public.is_room_host(room_id));

-- scores: visible to match participants; a user may write only their own score.
drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores
  for select to authenticated
  using (public.is_match_participant(match_id));

drop policy if exists scores_insert_self on public.scores;
create policy scores_insert_self on public.scores
  for insert to authenticated
  with check (player_id = auth.uid() and public.is_match_participant(match_id));

drop policy if exists scores_update_self on public.scores;
create policy scores_update_self on public.scores
  for update to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid());
