import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PALETTES } from '@/domain/palettes';
import { MOODS, MOOD_ORDER, VISIBILITY, VISIBILITY_ORDER } from '@/domain/states';
import { useTwin } from '@/store/twin';

export default function StatePicker() {
  const router = useRouter();
  const self = useTwin((s) => s.self);
  const ownPresence = useTwin((s) => s.ownPresence);
  const setVisibility = useTwin((s) => s.setVisibility);
  const setMood = useTwin((s) => s.setMood);
  const setCustomText = useTwin((s) => s.setCustomText);

  const [text, setText] = useState(ownPresence.customText ?? '');

  if (!self) return null;
  const p = PALETTES[self.palette];

  return (
    <LinearGradient colors={p.bg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ color: p.text }}>
              How are you?
            </ThemedText>
            <Pressable style={styles.close} onPress={() => router.back()} hitSlop={16}>
              <ThemedText style={{ color: p.accent }}>Done</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={[styles.section, { color: p.textMuted }]}>Visibility</ThemedText>
          <View style={styles.row}>
            {VISIBILITY_ORDER.map((id) => {
              const active = ownPresence.visibility === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setVisibility(id)}
                  style={[
                    styles.pill,
                    {
                      borderColor: active ? p.accent : 'rgba(255,255,255,0.1)',
                      backgroundColor: active ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <ThemedText style={{ color: active ? p.accent : p.text }}>
                    {VISIBILITY[id].label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={[styles.section, { color: p.textMuted }]}>Mood</ThemedText>
          <View style={styles.row}>
            <Pressable
              onPress={() => setMood(null)}
              style={[
                styles.moodChip,
                {
                  borderColor: ownPresence.mood == null ? p.accent : 'rgba(255,255,255,0.1)',
                },
              ]}
            >
              <ThemedText style={{ color: p.textMuted, fontSize: 20 }}>—</ThemedText>
            </Pressable>
            {MOOD_ORDER.map((id) => {
              const active = ownPresence.mood === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setMood(id)}
                  style={[
                    styles.moodChip,
                    {
                      borderColor: active ? p.accent : 'rgba(255,255,255,0.1)',
                    },
                  ]}
                >
                  <ThemedText style={{ fontSize: 22 }}>{MOODS[id].emoji}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={[styles.section, { color: p.textMuted }]}>Note (up to 30 chars)</ThemedText>
          <TextInput
            value={text}
            onChangeText={(t) => {
              const v = t.slice(0, 30);
              setText(v);
              setCustomText(v.length ? v : null);
            }}
            placeholder="Optional"
            placeholderTextColor={p.textMuted}
            maxLength={30}
            style={[styles.input, { color: p.text, borderColor: p.textMuted }]}
          />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingTop: 32, paddingBottom: 64 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: { padding: 12 },
  section: { marginTop: 32, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  moodChip: {
    borderWidth: StyleSheet.hairlineWidth,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    marginTop: 8,
    paddingVertical: 8,
    fontSize: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
