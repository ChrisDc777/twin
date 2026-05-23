import { createWidget } from 'expo-widgets';
import { HStack, Rectangle, Text, VStack, ZStack, Circle } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  opacity,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';

import { PALETTES } from '@/domain/palettes';
import { MOODS, VISIBILITY } from '@/domain/states';
import { softRelative } from '@/lib/time';
import type { PaletteId, PresenceState, WidgetSnapshot } from '@/domain/types';

type WidgetProps = {
  snapshot: WidgetSnapshot;
};

const EMPTY_PRESENCE: PresenceState = {
  visibility: 'visible',
  mood: null,
  customText: null,
  setAt: 0,
  expiresAt: null,
};

function HalfRow({
  palette,
  presence,
  name,
  isSelf,
}: {
  palette: PaletteId;
  presence: PresenceState;
  name: string | null;
  isSelf: boolean;
}) {
  const p = PALETTES[palette];
  const meta = VISIBILITY[presence.visibility];
  const dimmed = presence.visibility === 'sleeping' || presence.visibility === 'hidden';
  const moodEmoji = presence.mood ? MOODS[presence.mood].emoji : '';
  const blobOpacity = dimmed ? 0.4 : 1;

  return (
    <HStack modifiers={[padding({ vertical: 4 })]}>
      <ZStack modifiers={[frame({ width: 44, height: 44 }), opacity(blobOpacity)]}>
        <Circle
          modifiers={[
            foregroundStyle({
              type: 'linearGradient',
              colors: [p.blob[0], p.blob[1]],
              startPoint: { x: 0.2, y: 0.1 },
              endPoint: { x: 0.9, y: 0.95 },
            }),
          ]}
        />
        {moodEmoji ? <Text modifiers={[font({ size: 18 })]}>{moodEmoji}</Text> : null}
      </ZStack>

      <VStack modifiers={[padding({ leading: 12 })]}>
        <Text
          modifiers={[
            foregroundStyle(p.text),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          {presence.customText ?? meta.label}
        </Text>
        <Text modifiers={[foregroundStyle(p.textMuted), font({ size: 11 })]}>
          {isSelf
            ? 'you'
            : `${name ?? 'them'} · ${softRelative(presence.setAt)}`}
        </Text>
      </VStack>
    </HStack>
  );
}

export const iosWidget = createWidget<WidgetProps>('Twin', ({ snapshot }) => {
  'widget';

  const palette: PaletteId =
    snapshot.partner?.palette ?? snapshot.self?.palette ?? 'warm';
  const p = PALETTES[palette];

  if (!snapshot.self) {
    return (
      <ZStack modifiers={[containerBackground(p.bg[0], 'widget'), widgetURL('twin://')]}>
        <Rectangle
          modifiers={[
            foregroundStyle({
              type: 'linearGradient',
              colors: [p.bg[0], p.bg[1]],
              startPoint: { x: 0.5, y: 0 },
              endPoint: { x: 0.5, y: 1 },
            }),
          ]}
        />
        <Text modifiers={[foregroundStyle(p.textMuted), font({ size: 14 })]}>
          Open Twin to begin
        </Text>
      </ZStack>
    );
  }

  return (
    <ZStack modifiers={[containerBackground(p.bg[0], 'widget'), widgetURL('twin://')]}>
      <Rectangle
        modifiers={[
          foregroundStyle({
            type: 'linearGradient',
            colors: [p.bg[0], p.bg[1]],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          }),
        ]}
      />
      <VStack modifiers={[padding({ all: 12 })]}>
        {snapshot.partner ? (
          <HalfRow
            palette={snapshot.partner.palette}
            presence={snapshot.partner.presence}
            name={snapshot.partner.name}
            isSelf={false}
          />
        ) : (
          <Text modifiers={[foregroundStyle(p.textMuted), font({ size: 12 })]}>
            Waiting for them
          </Text>
        )}
        <HalfRow
          palette={snapshot.self.palette}
          presence={snapshot.own}
          name={snapshot.self.name}
          isSelf
        />
      </VStack>
    </ZStack>
  );
});

// Re-export for the sync layer.
export default iosWidget;
