import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { newId } from '@/lib/ids';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { currentUserId } from '@/services/auth';

const K_DEVICE_ID = 'device.id';

function deviceId(): string {
  let id = storage.getString(K_DEVICE_ID);
  if (!id) {
    id = newId();
    storage.set(K_DEVICE_ID, id);
  }
  return id;
}

// Idempotent. Returns the Expo push token if granted, else null.
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const tokenResp = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResp.data;

  const userId = await currentUserId();
  if (userId) {
    await supabase.from('device_tokens').upsert({
      user_id: userId,
      device_id: deviceId(),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      token,
      updated_at: new Date().toISOString(),
    });
  }

  return token;
}

// Remove the current device's push token from the server. Idempotent.
export async function unregisterPushToken(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId());
}

// Best-effort dispatch through the notify_partner edge function.
// Use sparingly — Twin's brand is anti-notification. Pulses only for now.
export async function notifyPartner(partnerId: string, kind: 'pulse'): Promise<void> {
  try {
    await supabase.functions.invoke('notify_partner', {
      body: { partnerId, kind },
    });
  } catch {
    // Silent — push is not load-bearing.
  }
}

// Set once at app boot via the notification handler. Twin shows banners only
// in foreground when explicitly enabled; defaults to silent.
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
