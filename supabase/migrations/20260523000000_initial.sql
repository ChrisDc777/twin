-- ============================================================================
-- Twin schema v0
-- ----------------------------------------------------------------------------
-- One-to-one private connections between two authenticated users.
-- Presence state is owned by each user and readable by their connection partner.
-- Custom note text is plain in this migration; Phase 4 swaps in a bytea
-- ciphertext column for end-to-end encryption.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  palette      text not null default 'warm',
  created_at   timestamptz not null default now()
);

create table public.invites (
  token        uuid primary key default gen_random_uuid(),
  from_user    uuid not null references auth.users(id) on delete cascade,
  display_name text,
  palette      text not null default 'warm',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_by  uuid references auth.users(id) on delete set null,
  accepted_at  timestamptz
);

create index invites_from_user_idx on public.invites(from_user);

-- Connections always stored with user_a < user_b so a pair has exactly one row.
create table public.connections (
  id        uuid primary key default gen_random_uuid(),
  user_a    uuid not null references auth.users(id) on delete cascade,
  user_b    uuid not null references auth.users(id) on delete cascade,
  palette   text not null default 'warm',
  paired_at timestamptz not null default now(),
  constraint connections_canonical_order check (user_a < user_b),
  constraint connections_distinct        check (user_a <> user_b),
  unique (user_a, user_b)
);

create index connections_user_a_idx on public.connections(user_a);
create index connections_user_b_idx on public.connections(user_b);

create table public.presence (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  visibility  text not null default 'visible',
  mood        text,
  custom_text text,
  set_at      timestamptz not null default now(),
  expires_at  timestamptz
);

create table public.reactions (
  id            bigserial primary key,
  connection_id uuid not null references public.connections(id) on delete cascade,
  from_user     uuid not null references auth.users(id) on delete cascade,
  kind          text not null default 'pulse',
  sent_at       timestamptz not null default now()
);

create index reactions_connection_idx on public.reactions(connection_id, sent_at desc);

-- ----------------------------------------------------------------------------
-- Realtime publication
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.presence;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.connections;

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.invites     enable row level security;
alter table public.connections enable row level security;
alter table public.presence    enable row level security;
alter table public.reactions   enable row level security;

-- profiles: read/write own; read partner via connection
create policy profiles_self_rw
  on public.profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profiles_partner_read
  on public.profiles for select
  using (
    exists (
      select 1 from public.connections c
      where (c.user_a = auth.uid() and c.user_b = profiles.user_id)
         or (c.user_b = auth.uid() and c.user_a = profiles.user_id)
    )
  );

-- invites: only creator can read/write their own
create policy invites_self_rw
  on public.invites for all
  using (from_user = auth.uid())
  with check (from_user = auth.uid());

-- invites: anyone authenticated can SELECT an invite by its token
-- (to render the preview before accepting). The token itself is the secret.
create policy invites_lookup_by_token
  on public.invites for select
  using (auth.role() = 'authenticated');

-- connections: only participants can see or delete
create policy connections_self_read
  on public.connections for select
  using (user_a = auth.uid() or user_b = auth.uid());

create policy connections_self_delete
  on public.connections for delete
  using (user_a = auth.uid() or user_b = auth.uid());
-- Inserts go through accept_invite() RPC, never directly.

-- presence: write own; read own + partner's
create policy presence_self_rw
  on public.presence for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy presence_partner_read
  on public.presence for select
  using (
    exists (
      select 1 from public.connections c
      where (c.user_a = auth.uid() and c.user_b = presence.user_id)
         or (c.user_b = auth.uid() and c.user_a = presence.user_id)
    )
  );

-- reactions: scoped to connections the user is part of
create policy reactions_in_connection
  on public.reactions for all
  using (
    exists (
      select 1 from public.connections c
      where c.id = reactions.connection_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  )
  with check (
    from_user = auth.uid()
    and exists (
      select 1 from public.connections c
      where c.id = reactions.connection_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- RPC: accept_invite
-- Atomically claims an invite and creates the corresponding connection.
-- SECURITY DEFINER so it can read invite rows the caller can't see directly.
-- ----------------------------------------------------------------------------
create or replace function public.accept_invite(token uuid)
returns public.connections
language plpgsql
security definer
set search_path = public
as $$
declare
  inv  public.invites;
  conn public.connections;
  a uuid;
  b uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select * into inv
    from public.invites
    where invites.token = accept_invite.token
    for update;

  if not found then raise exception 'invite not found'; end if;
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
    where invites.token = accept_invite.token;

  return conn;
end
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Touch trigger: keep presence.set_at fresh on any write where the caller
-- didn't supply it explicitly. (Optional; clients usually set it themselves.)
-- ----------------------------------------------------------------------------
create or replace function public.touch_presence_set_at()
returns trigger language plpgsql as $$
begin
  if new.set_at is null then
    new.set_at := now();
  end if;
  return new;
end $$;

create trigger presence_touch_set_at
  before insert or update on public.presence
  for each row execute function public.touch_presence_set_at();
