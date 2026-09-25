-- ============================================================================
-- Function hardening.
--
-- Supabase's own security linter flagged three things after 0001/0002. None
-- exposed data, but all three are worth closing. Run after 0002_storage.sql.
-- ============================================================================

-- 1. Pin the search_path on the timestamp trigger, so it cannot be influenced
--    by a caller's session settings.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. `handle_new_user` is only ever meant to run as a trigger. Because it sat
--    in the `public` schema, PostgREST also published it as a callable API
--    endpoint (/rest/v1/rpc/handle_new_user). Moving it to a private schema
--    removes it from the API surface entirely — a cleaner fix than juggling
--    EXECUTE grants.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();

-- 3. is_admin() must stay in `public` and stay callable by signed-in users,
--    because the RLS policies themselves call it. That is intentional: all a
--    signed-in user learns is whether they personally are an admin. Anonymous
--    visitors have no reason to call it, so the revoke is made explicit.
--    Supabase's linter will still report this one; it is a deliberate keep.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
