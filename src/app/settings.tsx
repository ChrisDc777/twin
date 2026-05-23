import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PALETTES, PALETTE_ORDER } from '@/domain/palettes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { deleteConnection } from '@/services/connection';
import { useTwin } from '@/store/twin';

export default function Settings() {
  const router = useRouter();
  const self = useTwin((s) => s.self);
  const connection = useTwin((s) => s.connection);
  const setPalette = useTwin((s) => s.setPalette);
  const setDisplayName = useTwin((s) => s.setDisplayName);
  const disconnect = useTwin((s) => s.disconnect);

  const [draftName, setDraftName] = useState(self?.displayName ?? '');

  if (!self) return null;
  const p = PALETTES[self.palette];

  const commitName = () => {
    setDisplayName(draftName);
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
            Twin · v0.1
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
