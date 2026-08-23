-- =============================================================================
-- Interactive Arcade Hub — Auth support (P1.2)
-- Auto-create a profile row on signup and expose a username-availability RPC.
-- =============================================================================

-- Create a profiles row whenever a new auth user is created. The username is
-- taken from signup metadata (raw_user_meta_data->>'username'), falling back to
-- a generated handle if absent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'player_' || substr(new.id::text, 1, 8)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anonymous-callable check so the signup form can validate username uniqueness
-- before attempting to create an account (profiles is not readable by anon).
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;
