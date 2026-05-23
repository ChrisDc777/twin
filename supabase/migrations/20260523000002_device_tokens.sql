-- ============================================================================
-- Twin schema v0.2 — Push device tokens
-- ----------------------------------------------------------------------------
-- Stores Expo push tokens per (user, device). Tokens routed through Expo's
-- push service so we don't need direct FCM/APNs credentials.
-- ============================================================================

create table public.device_tokens (
  user_id    uuid not null references auth.users(id) on delete cascade,
  device_id  text not null,
  platform   text not null check (platform in ('ios', 'android')),
  token      text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

-- Owner-only read/write. Edge Functions use the service role to bypass.
create policy device_tokens_self_rw
  on public.device_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
