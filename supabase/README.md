# Twin · Supabase backend

Local self-hosted Supabase. All schema lives in [migrations/](migrations/); the one Edge Function lives in [functions/notify_partner/](functions/notify_partner/).

## Bring it up

```powershell
npx supabase start            # first run pulls ~1.5 GB of Docker images
npx supabase status           # API URL, Publishable key, Studio URL
```

Studio: `http://127.0.0.1:54323`. Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

If anonymous sign-in is disabled (the Supabase default), edit `config.toml`:

```toml
enable_anonymous_sign_ins = true
```

…then `npx supabase stop && npx supabase start` to pick up the config change.

## Apply migrations

`supabase start` re-applies all migrations on init. For incremental updates while the stack is running:

```powershell
npx supabase migration up        # apply pending migrations
npx supabase db reset            # nuke + reapply (destroys local data)
```

## Schema (3 migrations)

### `20260523000000_initial.sql`

- **`profiles`** — display_name, palette per user; partner-readable via connection
- **`invites`** — single-use token, 7-day expiry, accepted_by snapshot
- **`connections`** — canonical-ordered (user_a < user_b) one-to-one pairing
- **`presence`** — single row per user with visibility + mood + custom_text
- **`reactions`** — append-only pulses
- **RLS** enforced everywhere; the accept-invite path goes through a `SECURITY DEFINER` RPC so the accepter can read invite rows the inviter owns
- **Realtime publication** includes `presence`, `reactions`, `connections`

### `20260523000001_e2e_keys.sql`

- Adds `public_key TEXT` to `profiles` and `invites`
- Clients publish their x25519 public key on first sign-in via `upsertProfile`
- Used to derive a shared symmetric secret on both sides for `custom_text` encryption

### `20260523000002_device_tokens.sql`

- **`device_tokens`** — Expo push tokens per (user, device)
- Owner-only RLS; Edge Functions use the service role to read partners' tokens
- One row per `(user_id, device_id)`, allowing multiple devices per user

## Edge Function: `notify_partner`

```
POST /functions/v1/notify_partner
{ "partnerId": "<uuid>", "kind": "pulse" }
```

Flow:
1. Verifies caller via JWT in the Authorization header
2. Confirms caller and `partnerId` share a connection (canonical-order lookup)
3. Fetches partner's device tokens via service-role client (bypasses RLS)
4. POSTs to `https://exp.host/--/api/v2/push/send` with one message per token
5. Returns `{ sent: number }`

**Why Expo Push:** no Firebase / Apple Developer setup needed for development. Production deploys still benefit from owning FCM/APNs eventually.

### Local dev

```powershell
npx supabase functions serve notify_partner --no-verify-jwt
# tail logs while you test
```

### Deploy (when you're ready)

```powershell
npx supabase functions deploy notify_partner --project-ref <your-ref>
```

## Environment

`.env.local` at repo root:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_... from supabase status>
```

**Android emulator:** replace `127.0.0.1` with `10.0.2.2`. **Physical device on Wi-Fi:** use the host's LAN IP.

## What's deliberately NOT in here

- No service-role keys committed (they live only in your `.env`)
- No production database state — local stack is volume-backed and survives restarts but is not for prod
- No CI seeds; the dev flow expects anonymous auth + manual exercise
