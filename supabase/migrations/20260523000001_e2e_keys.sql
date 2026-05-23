-- ============================================================================
-- Twin schema v0.1 — E2E key exchange
-- ----------------------------------------------------------------------------
-- Each user publishes their x25519 public key (base64) in their profile.
-- Pairs derive a shared secret locally (nacl.box.before) and never transmit
-- private keys or symmetric keys.
-- ============================================================================

alter table public.profiles  add column if not exists public_key text;
alter table public.invites   add column if not exists public_key text;

-- Backfill safety: profiles created before this migration would not have a key.
-- We allow null; clients self-heal by uploading their key on next auth.

comment on column public.profiles.public_key is 'x25519 public key, base64-encoded. Used by partner to derive a shared symmetric key for encrypting custom_text.';
comment on column public.invites.public_key  is 'Inviter''s x25519 public key snapshot at invite-creation time. Optional — accepter can also fetch via profile after pairing.';
