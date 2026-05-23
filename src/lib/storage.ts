import { createMMKV, type MMKV } from 'react-native-mmkv';

export const storage: MMKV = createMMKV({ id: 'twin.main' });

// Widget-readable mirror. On iOS this will be backed by an App Group
// (set via expo-widgets config plugin); on Android it will be wired to
// SharedPreferences via react-native-android-widget. Keep keys minimal.
export const widgetStorage: MMKV = createMMKV({ id: 'twin.widget' });

export function readJSON<T>(s: MMKV, key: string, fallback: T): T {
  const raw = s.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(s: MMKV, key: string, value: T): void {
  s.set(key, JSON.stringify(value));
}
