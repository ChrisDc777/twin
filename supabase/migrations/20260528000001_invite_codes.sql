-- ============================================================================
-- Twin schema v0.3 — human-readable invite codes
-- ----------------------------------------------------------------------------
-- The UUID token stays the primary, unguessable identifier carried by deep
-- links. This adds a short 6-char code from an unambiguous alphabet for the
-- "read it aloud / type it in" path.
--
-- Security note: the short code is enough of a secret given that invites are
-- single-use, expire in 7 days, pairing is immediately visible to the user,
-- and panic-disconnect is one tap. It is NOT meant to resist sustained
-- enumeration the way the UUID token does — deep links should always use the
-- token.
-- ============================================================================

alter table public.invites add column if not exists short_code text;
create unique index if not exists invites_short_code_idx on public.invites(short_code);

-- 6 chars from a Crockford-style alphabet (no 0/O/1/I/L) → 31^6 ≈ 887M combos.
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end
$$;

-- Atomic invite creation with collision-retry on the unique short_code.
-- SECURITY DEFINER so it can stamp from_user = auth.uid() reliably.
create or replace function public.create_invite(
  p_display_name text,
  p_palette text,
  p_public_key text
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites;
  attempt int := 0;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  loop
    begin
      insert into public.invites (from_user, display_name, palette, public_key, short_code)
        values (auth.uid(), p_display_name, p_palette, p_public_key, public.gen_invite_code())
        returning * into inv;
      return inv;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 10 then
        raise exception 'could not allocate a unique invite code';
      end if;
    end;
  end loop;
end
$$;

grant execute on function public.create_invite(text, text, text) to authenticated;

-- Shared accept logic, resolving from an already-fetched invite row.
-- SECURITY-CRITICAL: this trusts its `inv` argument, so it must NEVER be
-- callable directly by clients — a forged row would let anyone force a
-- pairing with any user. Execute is revoked from PUBLIC below; only the
-- SECURITY DEFINER wrappers (which run as the owner) may call it.
create or replace function public.accept_invite_row(inv public.invites)
returns public.connections
language plpgsql
security definer
set search_path = public
as $$
declare
  conn public.connections;
  a uuid;
  b uuid;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  if inv.accepted_by is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  if inv.from_user = auth.uid() then raise exception 'cannot accept own invite'; end if;

  if inv.from_user < auth.uid() then
    a := inv.from_user; b := auth.uid();
  else
    a := auth.uid();    b := inv.from_user;
  end if;

  insert into public.connections (user_a, user_b, palette)
    values (a, b, inv.palette)
    on conflict (user_a, user_b) do update set palette = excluded.palette
    returning * into conn;

  update public.invites
    set accepted_by = auth.uid(), accepted_at = now()
    where invites.token = inv.token;

  return conn;
end
$$;

-- Forced-pairing guard: keep this helper off the PostgREST surface.
-- Supabase default privileges explicitly grant EXECUTE to anon and
-- authenticated on new public functions, so revoking from PUBLIC alone
-- is not enough — revoke from the API roles by name too.
revoke all on function public.accept_invite_row(public.invites) from public;
revoke all on function public.accept_invite_row(public.invites) from anon;
revoke all on function public.accept_invite_row(public.invites) from authenticated;

-- Re-point the existing token-based RPC at the shared logic.
create or replace function public.accept_invite(token uuid)
returns public.connections
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites where invites.token = accept_invite.token for update;
  if not found then raise exception 'invite not found'; end if;
  return public.accept_invite_row(inv);
end
$$;

-- New: accept by the short human-readable code (case-insensitive).
create or replace function public.accept_invite_by_code(p_code text)
returns public.connections
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites;
begin
  select * into inv
    from public.invites
    where short_code = upper(trim(p_code))
    for update;
  if not found then raise exception 'invite not found'; end if;
  return public.accept_invite_row(inv);
end
$$;

grant execute on function public.accept_invite_by_code(text) to authenticated;
