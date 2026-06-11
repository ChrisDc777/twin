import type { WidgetSnapshot } from '@/domain/types';
import { readJSON, widgetStorage } from '@/lib/storage';
import { effectivePresence } from '@/lib/time';

export const SNAPSHOT_KEY = 'snapshot';

const EMPTY: WidgetSnapshot = {
  self: null,
  own: {
    visibility: 'visible',
    mood: null,
    customText: null,
    setAt: 0,
    expiresAt: null,
  },
  partner: null,
  updatedAt: 0,
};

// Single read path for both platform widgets. Expiry is applied at read
// time so a note that lapsed between snapshot-write and widget-refresh
// still fades correctly.
export function readWidgetSnapshot(): WidgetSnapshot {
  const raw = readJSON<WidgetSnapshot>(widgetStorage, SNAPSHOT_KEY, EMPTY);
  return {
    ...raw,
    own: effectivePresence(raw.own),
    partner: raw.partner
      ? { ...raw.partner, presence: effectivePresence(raw.partner.presence) }
      : null,
  };
}
