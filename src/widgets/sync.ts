// Default (iOS / web) implementation. Android has its own variant in
// sync.android.tsx that triggers a RemoteViews refresh.
export async function syncWidget(): Promise<void> {
  // no-op on non-Android platforms; iOS widget sync is handled by
  // expo-widgets via updateSnapshot() once we wire it in Phase 2b.
}
