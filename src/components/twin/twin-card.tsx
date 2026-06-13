import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { PulseGlow } from '@/components/twin/pulse-glow';
import { StateBlob } from '@/components/twin/state-blob';
import { ThemedText } from '@/components/themed-text';
import { PALETTES } from '@/domain/palettes';
import { MOODS, VISIBILITY } from '@/domain/states';
import { ageOpacity, effectivePresence, softRelative } from '@/lib/time';
import type { PaletteId, PresenceState } from '@/domain/types';

type Props = {
  who: string;
  palette: PaletteId;
  presence: PresenceState;
  onPress?: () => void;
  onLongPress?: () => void;
  showStaleness?: boolean;
  pulseTrigger?: number | null;
  size?: 'small' | 'large';
};

export function TwinCard({
  who,
  palette,
  presence: rawPresence,
  onPress,
  onLongPress,
  showStaleness,
  pulseTrigger,
  size = 'large',
}: Props) {
  const presence = effectivePresence(rawPresence);
  const meta = VISIBILITY[presence.visibility];
  const p = PALETTES[palette];
  const blobSize = size === 'large' ? 200 : 140;
  const dimmed = presence.visibility === 'sleeping' || presence.visibility === 'hidden';
  const aged = !dimmed && presence.setAt > 0 ? ageOpacity(presence.setAt) : 1;

  const interactive = !!(onPress || onLongPress);
  const a11yLabel = [
    who,
    meta.label,
    presence.mood ? MOODS[presence.mood].label : null,
    presence.customText ? `note: ${presence.customText}` : null,
    showStaleness && presence.setAt > 0 ? softRelative(presence.setAt) : null,
  ]
    .filter(Boolean)
    .join(', ');
  const a11yHint = onLongPress
    ? 'Hold to send a quiet pulse'
    : onPress
      ? 'Opens your status to change it'
      : undefined;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      onLongPress={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onLongPress?.();
      }}
      accessibilityRole={interactive ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
      style={styles.wrap}
    >
      <View
        style={[styles.blobStack, { width: blobSize, height: blobSize }]}
        importantForAccessibility="no-hide-descendants"
      >
        <PulseGlow trigger={pulseTrigger ?? null} color={p.accent} size={blobSize} />
        <View style={{ opacity: aged }}>
          <StateBlob
            palette={palette}
            mood={presence.mood ?? undefined}
            dimmed={dimmed}
            size={blobSize}
          />
        </View>
      </View>
      <View style={styles.captionWrap}>
        <ThemedText type="subtitle" style={{ color: p.text }}>
          {meta.label}
        </ThemedText>
        {presence.customText ? (
          <ThemedText style={{ color: p.textMuted, fontStyle: 'italic' }}>
            "{presence.customText}"
          </ThemedText>
        ) : (
          <ThemedText style={{ color: p.textMuted }}>{who}</ThemedText>
        )}
        {showStaleness && presence.setAt > 0 ? (
          <ThemedText type="small" style={{ color: p.textMuted, opacity: 0.7 }}>
            {softRelative(presence.setAt)}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 20, paddingVertical: 12 },
  blobStack: { alignItems: 'center', justifyContent: 'center' },
  captionWrap: { alignItems: 'center', gap: 6 },
});
