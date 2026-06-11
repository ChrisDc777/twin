# Twin

> A quieter way to feel close.

Twin is a mobile app for ambient presence between two people. You and one other person — a partner, a parent, a best friend in another city — share a small widget on each other's home screens. They glance, see how you are, and nothing more is required. No chat. No streaks. No badges. The widget *is* the notification.

This repo is the working build of Twin v0.2. UI, Android widget, Supabase backend, end-to-end encryption, and a push skeleton are all live and type-clean. iOS widget code is written but needs macOS or [EAS Build](https://docs.expo.dev/build/setup/) to compile.

---

## What "ambient" means here

Twin deliberately refuses the engagement patterns of every other social app:

- **No push by default.** The home screen widget *is* the surface. Pulses (an explicit "thinking of you" tap-and-hold) are the one opt-in notification.
- **No streaks, no counters, no "you haven't checked in for…"** Anti-engagement is the brand.
- **No timestamps with minutes.** "A little while ago" instead of "14m". Soft time, not surveillance time.
- **Status decays.** A state set six hours ago renders dimmer than one set six minutes ago. It never disappears.
- **Custom text is end-to-end encrypted.** The server stores ciphertext only.
- **Panic disconnect is single-tap.** Removes the connection instantly with no confirmation step that an abuser could intercept.

If you find yourself building a streak, you've built a different app.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| App framework | Expo SDK 56 + RN 0.85 + React 19 + TypeScript | New architecture on; native modules required (no Expo Go) |
| Router | `expo-router` | File-based routing in `src/app/` |
| State | Zustand + `react-native-mmkv` v4 | Fast local persistence; MMKV mirror for widget storage |
| Android widget | [`react-native-android-widget`](https://github.com/sAleksovski/react-native-android-widget) | JSX → RemoteViews; supports gradients |
| iOS widget | [`expo-widgets`](https://docs.expo.dev/versions/latest/sdk/widgets/) + `@expo/ui/swift-ui` | Official Expo package; JSX → SwiftUI (no Swift code required) |
| Backend | Local self-hosted Supabase via Docker | Postgres + Realtime + Anonymous Auth + Edge Functions |
| Crypto | `tweetnacl` (x25519 + secretbox) | Per-connection shared key derived from public keys; never transmitted |
| Push | Expo Push API via Supabase Edge Function | No FCM/APNs credentials needed for development |

---

## Quick start

### Prerequisites
- Node 22 LTS (Node 21 works but Expo SDK 56 wants 20.19+ / 22.13+ — install via [nvm-windows](https://github.com/coreybutler/nvm-windows) if Gradle complains)
- Docker Desktop (running, for local Supabase)
- For real-device runs: either a JDK 17 + Android SDK locally, or an [EAS account](https://expo.dev/) for cloud builds

### Install
```powershell
npm install
```

### Start the backend
```powershell
npx supabase start
# wait for it to come up — first run pulls ~1.5 GB of Docker images
npx supabase status   # copy URL + Publishable key
```

Create `.env.local` from `.env.example` and paste the values. **Important for Android emulator:** change the host from `127.0.0.1` to `10.0.2.2` (the emulator's loopback to the host machine). Physical device on Wi-Fi: use the host machine's LAN IP.

### Run the app
- **Real device, cloud build (recommended on Windows without Android Studio):**
  ```powershell
  npx eas login
  npx eas build:configure
  npx eas build --profile development --platform android
  # install resulting APK, then:
  npx expo start --dev-client
  ```
- **Real device, local build (Android Studio + JDK 17 installed):**
  ```powershell
  npx expo run:android
  ```
- **Web (in-app screens only, no widget surface):** native modules block this — won't work as-is.

> **Expo Go won't work.** MMKV, the Android widget plugin, and expo-widgets are all native modules. Use a dev client.

---

## Project structure

```
twin/
├── src/
│   ├── app/                        # expo-router screens
│   │   ├── _layout.tsx             # root stack; hydrates store + starts sync
│   │   ├── index.tsx               # Home (paired vs unpaired)
│   │   ├── onboarding.tsx          # 3-step: welcome → name → palette
│   │   ├── state-picker.tsx        # Modal: visibility + mood + note
│   │   ├── pair.tsx                # Create + accept invite (both modes)
│   │   └── settings.tsx            # Name, palette, disconnect
│   ├── components/twin/
│   │   ├── state-blob.tsx          # Breathing gradient circle + mood emoji
│   │   ├── twin-card.tsx           # Blob + caption + soft relative time
│   │   └── pulse-glow.tsx          # Animated halo on incoming pulse
│   ├── domain/
│   │   ├── types.ts                # VisibilityId, Mood, Palette, Presence, …
│   │   ├── states.ts               # 6 visibility states + 8 moods
│   │   └── palettes.ts             # 8 color palettes
│   ├── lib/
│   │   ├── storage.ts              # MMKV (main + widget mirror)
│   │   ├── crypto.ts               # tweetnacl keypair + shared key + box
│   │   ├── ids.ts                  # nanoid
│   │   ├── time.ts                 # softRelative + ageOpacity
│   │   ├── supabase.ts             # client + MMKV auth adapter
│   │   └── pending-invite.ts       # token stash across onboarding bounce
│   ├── services/
│   │   ├── auth.ts                 # ensureAnonymousAuth + ensureKeypair
│   │   ├── connection.ts           # invites, accept, profile, disconnect
│   │   ├── presence.ts             # encrypt-on-write, decrypt-on-read
│   │   └── push.ts                 # Expo push token register + notifyPartner
│   ├── store/
│   │   ├── twin.ts                 # Zustand store + widget snapshot mirror
│   │   └── sync.ts                 # Realtime + partner key + presence sync
│   └── widgets/
│       ├── twin-android-widget.tsx # JSX → RemoteViews
│       ├── twin-ios-widget.ios.tsx # JSX → SwiftUI
│       ├── widget-task-handler.tsx # Android headless task
│       ├── widget-snapshot.ts      # MMKV reader for widget render
│       ├── sync.ts                 # no-op default
│       ├── sync.android.tsx        # requestWidgetUpdate
│       └── sync.ios.tsx            # updateSnapshot
├── supabase/
│   ├── README.md                   # backend setup details
│   ├── config.toml                 # local stack config (anonymous auth ON)
│   ├── migrations/                 # initial schema → e2e keys → device tokens
│   └── functions/notify_partner/   # Edge Function for pulses via Expo Push
├── index.js                        # Custom entry — registers Android widget task handler
├── app.json                        # Expo config (plugins: widgets, splash)
├── AGENTS.md                       # Per-session agent instructions
├── CLAUDE.md                       # Pointer to AGENTS.md
└── README.md                       # ← you are here
```

---

## How the data flows

```
[ User A app ]                            [ User A widget surface ]
     │                                              ▲
     │ setVisibility/Mood/Text                      │  read MMKV snapshot
     ▼                                              │
[ Zustand store ] ──► pushWidget() ──► [ MMKV widget mirror ]
     │                                  ▲
     │ writeOwnPresence (encrypted)     │ requestWidgetUpdate /
     ▼                                  │ updateSnapshot
[ Supabase Postgres ]                   │
     │                                  │
     │ Realtime (websocket)             │
     ▼                                  │
[ User B app subscribes ] ──► setConnection() ──► pushWidget() ──┘
     │
     │ Pulse only: invoke notify_partner Edge Function
     ▼
[ Expo Push → User A's device ]
```

Custom-text encryption: A and B publish x25519 public keys in `profiles`. On pair, both derive the same shared secret locally via `nacl.box.before`. The server only ever sees `enc:<base64>` ciphertext.

---

## Current state

### Working and verified
- Onboarding, pair (create + accept with token stash for unboarded invitees), state picker, settings, panic disconnect
- Android widget (gradient blob, two halves, OPEN_APP click)
- Anonymous auth + profile + connection + presence + pulses + invites RLS-enforced
- Realtime presence + pulse subscriptions (in-app, no FCM needed when foregrounded)
- E2E encryption on `custom_text` with `enc:` prefix
- Push for pulses via Expo Push API (no FCM/APNs creds required), opt-in via Settings toggle or the one-time post-pair prompt
- Disappearing notes — optional expiry (1h / 8h) set in the state picker, enforced at render on app and both widgets
- Pulses rate-limited (1 per 30s) with a light haptic on receive; sender's own realtime echo filtered out
- Offline presence writes retry on app-foreground instead of silently dropping
- Account deletion (two-tap, RPC verified end-to-end locally) + JSON data export via share sheet
- Android prebuild succeeds — `widgetprovider_twin.xml` and AppWidgetProvider receiver land cleanly in the generated manifest
- CI on GitHub Actions: type-check + Android prebuild validation per push/PR

### Verified via REST
```
✅ profiles, connections, invites, presence, device_tokens → 200
✅ accept_invite RPC → reachable; rejects unauth'd as expected
✅ supabase_realtime publication → connections, presence, reactions
✅ /auth/v1/signup with empty body → returns access_token
```

### Deferred (tracked as GitHub issues)
- iOS widget can't be compiled from Windows (needs macOS or EAS Build)
- Local Gradle build needs JDK 17 + Android SDK (or use EAS Build cloud)
- Background widget refresh when app is killed (needs silent push + native refresh handler)
- Linked auth upgrade (currently anonymous-only)
- Multi-connection / groups
- Live Activities / Dynamic Island
- Crash reporting, accessibility audit, MMKV at-rest encryption, human-readable pair codes, store metadata

---

## Branding direction

**Name:** Twin. Two people, mirrored states. Short, ownable, not romance-specific (siblings, parent-child, best friends all fit).

**Visual:** soft gradients, organic shapes, generous whitespace. The "blob" is a circle that breathes (4.2s slow scale). Mood is one emoji inside the blob. Custom note is italic small text. Time is soft prose. Eight color palettes; the connection shares one palette set by the inviter.

**Avoid:** sharp corners, hard shadows, dense info, "dashboard energy," gamified badges, neon, glassmorphism. Default to dark.

---

## License

MIT — see [LICENSE](LICENSE).
