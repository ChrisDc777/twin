# Agent instructions for Twin

You're working on Twin — an ambient-presence widget app. Read [README.md](README.md) first for the product idea and architecture. This file is the per-session operating manual.

## Always read the versioned docs

Expo SDK 56 docs: https://docs.expo.dev/versions/v56.0.0/. The exports here move between SDKs — don't guess from training data.

## Gotchas I've burned a session learning

- **`react-native-mmkv` v4 is Nitro-based.** Use `createMMKV({ id })`, NOT `new MMKV(...)`. The `MMKV` symbol is a type, not a class. Delete keys with `remove()`, not `delete()`.
- **expo-widgets is the official iOS widget path** (SDK 56+). UI compiles from JSX via `@expo/ui/swift-ui` primitives — no Swift code required for the basic widget. Fall back to `@bacons/apple-targets` only for advanced extension targets.
- **iOS widget config plugin requires `ios.bundleIdentifier`** in `app.json` or expo-config will throw `iOS bundle identifier is required`.
- **Local Supabase URL on Android emulator: use `10.0.2.2:54321`**, not `127.0.0.1`. On physical devices: host LAN IP.
- **Anonymous auth is OFF by default in Supabase.** Flip `enable_anonymous_sign_ins = true` in `supabase/config.toml` and restart.
- **`expo prebuild` rewrites `android/` from scratch.** The folder is gitignored; treat it as a build artifact, not source.
- **Node 21 is between supported versions** for Expo SDK 56 (wants 20.19+ or 22.13+). Type-check passes; Gradle build may not.
- **Custom-text E2E:** values written by the encrypted path get a `enc:` prefix. `decryptFromPartner` returns plaintext as-is if no prefix. Don't strip the prefix server-side.
- **Rules of hooks:** keep `useEffect` before any `if (!self) return null;` early return inside screen components. We hit this once in pair.tsx.
- **`Tee-Object` for command capture truncates badly on errors.** Re-run with direct stderr to debug PowerShell install failures.

## File conventions

- Domain types in `src/domain/`. Don't put them under `src/lib/`.
- Service layer (Supabase API calls) in `src/services/`. Don't import Supabase client from screens or store actions — go through services.
- Zustand store actions stay local-only. Network side effects live in `src/store/sync.ts`, which subscribes to store changes.
- Platform-specific implementations use Metro's `.android.tsx` / `.ios.tsx` extension resolution. See `src/widgets/sync.ts` (default), `sync.android.tsx`, `sync.ios.tsx`.
- The Android widget JSX uses `react-native-android-widget` primitives (`FlexWidget`, `TextWidget`). Not React Native components.
- The iOS widget JSX uses `@expo/ui/swift-ui` primitives (`VStack`, `HStack`, `Circle`, `Rectangle`, `Text`) with a `'widget'` directive at the top of the layout function body.

## Brand-defining rules

These are anti-engagement product rules, not personal preferences:

- **Default no push.** Only pulse explicitly notifies. No app-state-change banners.
- **No streaks. No counters. No "you haven't checked in".**
- **No timestamps with minutes.** Use `softRelative` from `lib/time.ts`.
- **Status decays continuously.** Older blobs render dimmer via `ageOpacity`.
- **Panic disconnect is single-tap, no confirmation.** Abuse-safety, not a UX laziness.

If a feature request suggests breaking one of these, push back before implementing.

## When you make changes

1. Run `npx tsc --noEmit` after every batch of edits. Strict mode is on.
2. After backend changes: `npx supabase migration up` to apply new migrations.
3. After plugin or app.json changes: re-run `npx expo prebuild --platform android --clean --no-install` to validate config.
4. Don't commit unless the user asks. When they do: NEW commits, not amends.
5. **Don't push to the remote unless asked.** Twin pushes go to `main` on the user's GitHub.

## Deferred work (open GitHub issues)

See the repo's Issues tab. Major outstanding items:

- iOS widget verification — needs Mac or EAS Build
- Local Gradle build — needs JDK 17 + Android SDK
- Background widget refresh when app is killed
- Push registration UI / opt-in entry point
- Linked auth upgrade (Apple/Google sign-in)
- Multi-connection / groups
- Live Activities / Dynamic Island

## Test plan when verifying changes

There is no automated suite. Manual verification path:
1. `npx supabase status` → backend healthy
2. `npx tsc --noEmit` → type clean
3. `npx expo prebuild --platform android --clean --no-install` → exits 0
4. (Where possible) `eas build --profile development --platform android` → APK installs and app boots on device
