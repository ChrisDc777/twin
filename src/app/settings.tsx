import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PALETTES, PALETTE_ORDER } from '@/domain/palettes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { deleteConnection } from '@/services/connection';
import { registerPushToken, unregisterPushToken } from '@/services/push';
import { useTwin } from '@/store/twin';

export default function Settings() {
  const router = useRouter();
  const self = useTwin((s) => s.self);
  const connection = useTwin((s) => s.connection);
  const pushOptedIn = useTwin((s) => s.pushOptedIn);
  const setPalette = useTwin((s) => s.setPalette);
  const setDisplayName = useTwin((s) => s.setDisplayName);
  const setPushOptedIn = useTwin((s) => s.setPushOptedIn);
  const disconnect = useTwin((s) => s.disconnect);

  const [draftName, setDraftName] = useState(self?.displayName ?? '');
  const [pushBusy, setPushBusy] = useState(false);

  if (!self) return null;
  const p = PALETTES[self.palette];

  const commitName = () => setDisplayName(draftName);

  const togglePush = async (next: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushOptedIn(next);
    try {
      if (next) {
        const token = await registerPushToken();
        if (!token) {
          // Permission denied or no real device — revert silently.
          setPushOptedIn(false);
        }
      } else {
        await unregisterPushToken().catch(() => {});
      }
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <LinearGradient colors={p.bg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ color: p.text }}>
              Settings
            </ThemedText>
            <Pressable style={styles.close} onPress={() => router.back()} hitSlop={16}>
              <ThemedText style={{ color: p.accent }}>Done</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={[styles.section, { color: p.textMuted }]}>Your name</ThemedText>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            onBlur={commitName}
            onSubmitEditing={commitName}
            placeholder="Optional"
            placeholderTextColor={p.textMuted}
            maxLength={24}
            style={[styles.input, { color: p.text, borderColor: p.textMuted }]}
          />

          <ThemedText style={[styles.section, { color: p.textMuted }]}>Colour</ThemedText>
          <View style={styles.row}>
            {PALETTE_ORDER.map((id) => (
              <Pressable
                key={id}
                onPress={() => setPalette(id)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: PALETTES[id].blob[0],
                    borderColor: id === self.palette ? p.text : 'transparent',
                  },
                ]}
              />
            ))}
          </View>

          {connection ? (
            <>
              <ThemedText style={[styles.section, { color: p.textMuted }]}>Notifications</ThemedText>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <ThemedText style={{ color: p.text }}>Soft pulses</ThemedText>
                  <ThemedText type="small" style={{ color: p.textMuted, marginTop: 2 }}>
                    A quiet tap when {connection.partner.displayName ?? 'they'} reaches.
                  </ThemedText>
                </View>
                <Switch
                  value={pushOptedIn}
                  onValueChange={togglePush}
                  disabled={pushBusy || !isSupabaseConfigured()}
                  trackColor={{ true: p.accent, false: 'rgba(255,255,255,0.12)' }}
                  thumbColor={pushOptedIn ? p.text : '#888'}
                />
              </View>
            </>
          ) : null}

          {connection ? (
            <Pressable
              style={[styles.danger, { borderColor: 'rgba(255,80,80,0.4)' }]}
              onPress={async () => {
                if (isSupabaseConfigured()) {
                  await deleteConnection(connection.id).catch(() => {});
                }
                disconnect();
                router.back();
              }}
            >
              <ThemedText style={{ color: '#ff8b8b' }}>
                Disconnect from {connection.partner.displayName ?? 'them'}
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={{ flex: 1 }} />
          <ThemedText
            type="small"
            style={{ color: p.textMuted, opacity: 0.5, textAlign: 'center' }}
          >
            Twin · v0.2
          </ThemedText>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 24, paddingTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: { padding: 12 },
  section: { marginTop: 32, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  input: {
    marginTop: 8,
    paddingVertical: 8,
    fontSize: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  danger: {
    marginTop: 48,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
