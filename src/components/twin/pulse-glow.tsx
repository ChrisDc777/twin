import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  // Bumped any time a new pulse is received. The component reacts to changes,
  // not values, so any new timestamp triggers an animation.
  trigger: number | null;
  color: `#${string}`;
  size: number;
};

// A soft halo that swells outward once when triggered. Lives behind StateBlob.
export function PulseGlow({ trigger, color, size }: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (trigger == null) return;
    if (reduceMotion) {
      // Reduced-motion: a brief static fade instead of an expanding halo.
      opacity.value = withSequence(
        withTiming(0.4, { duration: 200 }),
        withTiming(0, { duration: 600 }),
      );
      return;
    }
    scale.value = 0.6;
    opacity.value = 0;
    opacity.value = withSequence(
      withTiming(0.55, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 1100, easing: Easing.in(Easing.quad) }),
    );
    scale.value = withTiming(1.55, { duration: 1300, easing: Easing.out(Easing.cubic) });
  }, [trigger, scale, opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
