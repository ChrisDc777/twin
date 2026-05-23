import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { PALETTES } from '@/domain/palettes';
import { MOODS, VISIBILITY } from '@/domain/states';
import { softRelative } from '@/lib/time';
import type { PaletteId, PresenceState, WidgetSnapshot } from '@/domain/types';

type Props = {
  snapshot: WidgetSnapshot;
  width: number;
  height: number;
};

export function TwinAndroidWidget({ snapshot }: Props) {
  const palette: PaletteId =
    snapshot.partner?.palette ?? snapshot.self?.palette ?? 'warm';
  const p = PALETTES[palette];

  if (!snapshot.self) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          width: 'match_parent',
          height: 'match_parent',
          backgroundGradient: { from: p.bg[0], to: p.bg[1], orientation: 'TOP_BOTTOM' },
          padding: 16,
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TextWidget text="Open Twin to begin" style={{ color: p.textMuted, fontSize: 14 }} />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundGradient: { from: p.bg[0], to: p.bg[1], orientation: 'TOP_BOTTOM' },
        padding: 14,
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {snapshot.partner ? (
        <Half
          palette={snapshot.partner.palette}
          state={snapshot.partner.presence}
          name={snapshot.partner.name}
        />
      ) : (
        <FlexWidget
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text="Waiting for them"
            style={{ color: p.textMuted, fontSize: 12 }}
          />
        </FlexWidget>
      )}

      <FlexWidget
        style={{
          height: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          marginVertical: 6,
        }}
      />

      <Half
        palette={snapshot.self.palette}
        state={snapshot.own}
        name={snapshot.self.name}
        isSelf
      />
    </FlexWidget>
  );
}

type HalfProps = {
  palette: PaletteId;
  state: PresenceState;
  name: string | null;
  isSelf?: boolean;
};

function Half({ palette, state, name, isSelf }: HalfProps) {
  const p = PALETTES[palette];
  const meta = VISIBILITY[state.visibility];
  const dimmed = state.visibility === 'sleeping' || state.visibility === 'hidden';
  const moodEmoji = state.mood ? MOODS[state.mood].emoji : '';

  return (
    <FlexWidget
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
      }}
    >
      <FlexWidget
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundGradient: dimmed
            ? { from: 'rgba(255, 255, 255, 0.08)', to: 'rgba(255, 255, 255, 0.04)', orientation: 'BR_TL' }
            : { from: p.blob[0], to: p.blob[1], orientation: 'BR_TL' },
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {moodEmoji ? <TextWidget text={moodEmoji} style={{ fontSize: 18 }} /> : null}
      </FlexWidget>

      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={state.customText ?? meta.label}
          style={{ color: p.text, fontSize: 14, fontWeight: '600' }}
          maxLines={1}
          truncate="END"
        />
        <TextWidget
          text={isSelf ? 'you' : `${name ?? 'them'} · ${softRelative(state.setAt)}`}
          style={{ color: p.textMuted, fontSize: 11 }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
    </FlexWidget>
  );
}
