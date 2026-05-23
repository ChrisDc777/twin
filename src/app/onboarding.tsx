import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { StateBlob } from '@/components/twin/state-blob';
import { PALETTES, PALETTE_ORDER } from '@/domain/palettes';
import { getPendingInvite, setPendingInvite } from '@/lib/pending-invite';
import { useTwin } from '@/store/twin';
import type { PaletteId } from '@/domain/types';

type Step = 'welcome' | 'name' | 'palette';

export default function Onboarding() {
  const router = useRouter();
  const createSelf = useTwin((s) => s.createSelf);
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [palette, setPalette] = useState<PaletteId>('warm');

  const p = PALETTES[palette];

  const next = () => {
    if (step === 'welcome') setStep('name');
    else if (step === 'name') setStep('palette');
    else {
      createSelf(name.trim() || null, palette);
      const pending = getPendingInvite();
      if (pending) {
        setPendingInvite(null);
        router.replace(`/pair?token=${pending}`);
      } else {
        router.replace('/');
      }
    }
  };

  return (
    <LinearGradient colors={p.bg} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.canvas}>
          <StateBlob palette={palette} size={180} />

          {step === 'welcome' && (
            <View style={styles.copy}>
              <ThemedText type="title" style={{ color: p.text, textAlign: 'center' }}>
                A quieter way to{'\n'}feel close.
              </ThemedText>
              <ThemedText
                style={{ color: p.textMuted, textAlign: 'center', maxWidth: 280 }}
              >
                Twin is one small shared widget between you and one person. No chat. No noise.
              </ThemedText>
            </View>
          )}

          {step === 'name' && (
            <View style={styles.copy}>
              <ThemedText type="subtitle" style={{ color: p.text, textAlign: 'center' }}>
                What should we call you?
              </ThemedText>
              <TextInput
                placeholder="Optional"
                placeholderTextColor={p.textMuted}
                value={name}
                onChangeText={setName}
                style={[styles.input, { color: p.text, borderColor: p.textMuted }]}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={next}
              />
            </View>
          )}

          {step === 'palette' && (
            <View style={styles.copy}>
              <ThemedText type="subtitle" style={{ color: p.text, textAlign: 'center' }}>
                Pick your colour.
              </ThemedText>
              <View style={styles.paletteRow}>
                {PALETTE_ORDER.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => setPalette(id)}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: PALETTES[id].blob[0],
                        borderColor: id === palette ? p.text : 'transparent',
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        <Pressable onPress={next} style={[styles.cta, { borderColor: p.accent }]}>
          <ThemedText style={{ color: p.accent }}>
            {step === 'palette' ? 'Begin' : 'Continue'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 },
  copy: { alignItems: 'center', gap: 16 },
  input: {
    width: 240,
    textAlign: 'center',
    fontSize: 24,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  paletteRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  cta: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
});
