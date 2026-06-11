-- ============================================================================
-- Twin schema v0.3 — self-service account deletion
-- ----------------------------------------------------------------------------
-- App Store / Play Store both require an in-app deletion path. The function
-- is SECURITY DEFINER so it can delete from auth.users (the definer is the
-- migration role, which owns the auth schema locally and on hosted Supabase).
-- All app data is removed via the existing ON DELETE CASCADE foreign keys.
-- ============================================================================

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

grant execute on function public.delete_account() to authenticated;
