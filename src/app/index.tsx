import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { TwinCard } from '@/components/twin/twin-card';
import { PALETTES } from '@/domain/palettes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { sendPulse } from '@/services/presence';
import { notifyPartner } from '@/services/push';
import { useTwin } from '@/store/twin';

export default function Home() {
  const router = useRouter();
  const hydrated = useTwin((s) => s.hydrated);
  const self = useTwin((s) => s.self);
  const ownPresence = useTwin((s) => s.ownPresence);
  const connection = useTwin((s) => s.connection);
  const incomingPulseAt = useTwin((s) => s.incomingPulseAt);
  const devFakePair = useTwin((s) => s.devFakePair);

  const lastPulseSentAt = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!self) router.replace('/onboarding');
  }, [hydrated, self, router]);

  // A soft haptic when the partner reaches — the glow is the visual,
  // this is the touch. No banner, no sound.
  useEffect(() => {
    if (incomingPulseAt == null) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [incomingPulseAt]);

  if (!self) return null;

  const myPalette = self.palette;
  const sharedPalette = connection?.palette ?? myPalette;
  const p = PALETTES[sharedPalette];

  const onLongPressPartner = () => {
    if (!connection) return;
    // Rate-limit: one pulse per 30s. Quiet things shouldn't be spammable.
    const now = Date.now();
    if (now - lastPulseSentAt.current < 30_000) return;
    lastPulseSentAt.current = now;
    if (isSupabaseConfigured()) {
      void sendPulse(connection.id).catch(() => {});
      void notifyPartner(connection.partner.id, 'pulse').catch(() => {});
    }
  };

  return (
    <LinearGradient colors={p.bg} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        {connection ? (
          <>
            <View style={styles.half}>
              <TwinCard
                who={connection.partner.displayName ?? 'Them'}
                palette={connection.palette}
                presence={connection.partner.presence}
                pulseTrigger={incomingPulseAt}
                onLongPress={onLongPressPartner}
                showStaleness
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.half}>
              <TwinCard
                who={self.displayName ?? 'You'}
                palette={myPalette}
                presence={ownPresence}
                onPress={() => router.push('/state-picker')}
              />
            </View>
          </>
        ) : (
          <View style={styles.unpaired}>
            <TwinCard
              who={self.displayName ?? 'You'}
              palette={myPalette}
              presence={ownPresence}
              onPress={() => router.push('/state-picker')}
            />
            <View style={{ gap: 12, alignItems: 'center' }}>
              <Pressable style={styles.ctaPrimary} onPress={() => router.push('/pair')}>
                <ThemedText style={{ color: p.accent }}>Invite your person →</ThemedText>
              </Pressable>
              {__DEV__ && !isSupabaseConfigured() ? (
                <Pressable onPress={devFakePair}>
                  <ThemedText type="small" style={{ color: p.textMuted, opacity: 0.6 }}>
                    dev: fake pair
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        <Pressable style={styles.settings} onPress={() => router.push('/settings')} hitSlop={16}>
          <ThemedText style={{ color: p.textMuted, fontSize: 22 }}>·</ThemedText>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  divider: {
    height: 1,
    opacity: 0.06,
    backgroundColor: '#fff',
    marginHorizontal: 56,
  },
  unpaired: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 },
  ctaPrimary: { paddingVertical: 12, paddingHorizontal: 20 },
  settings: { position: 'absolute', top: 12, right: 16, padding: 16 },
});
