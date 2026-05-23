import type { WidgetSnapshot } from '@/domain/types';
import { readJSON, widgetStorage } from '@/lib/storage';

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

export function readWidgetSnapshot(): WidgetSnapshot {
  return readJSON<WidgetSnapshot>(widgetStorage, SNAPSHOT_KEY, EMPTY);
}
