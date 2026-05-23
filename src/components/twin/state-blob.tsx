import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { MOODS } from '@/domain/states';
import { PALETTES } from '@/domain/palettes';
import { ThemedText } from '@/components/themed-text';
import type { Mood, PaletteId } from '@/domain/types';

type Props = {
  palette: PaletteId;
  mood?: Mood | null;
  dimmed?: boolean;
  size?: number;
};

export function StateBlob({ palette, mood, dimmed = false, size = 200 }: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(dimmed ? 0.4 : 1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.04, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [scale]);

  useEffect(() => {
    opacity.value = withTiming(dimmed ? 0.35 : 1, { duration: 600 });
  }, [dimmed, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const p = PALETTES[palette];

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={p.blob}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 0.95 }}
        style={[styles.fill, { borderRadius: size / 2 }]}
      />
      {mood ? (
        <View style={styles.glyphWrap} pointerEvents="none">
          <ThemedText style={{ fontSize: size * 0.32 }}>{MOODS[mood].emoji}</ThemedText>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  glyphWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
