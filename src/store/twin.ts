import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type {
  Connection,
  Mood,
  PaletteId,
  PresenceState,
  SelfProfile,
  VisibilityId,
  WidgetSnapshot,
} from '@/domain/types';
import { newId } from '@/lib/ids';
import { readJSON, storage, widgetStorage, writeJSON } from '@/lib/storage';
import { syncWidget } from '@/widgets/sync';

const K_SELF = 'self';
const K_CONNECTION = 'connection';
const K_OWN_PRESENCE = 'ownPresence';
const K_WIDGET_SNAPSHOT = 'snapshot';

const blankPresence = (): PresenceState => ({
  visibility: 'visible',
  mood: null,
  customText: null,
  setAt: Date.now(),
  expiresAt: null,
});

type TwinState = {
  hydrated: boolean;
  self: SelfProfile | null;
  ownPresence: PresenceState;
  connection: Connection | null;
  incomingPulseAt: number | null;

  hydrate: () => void;
  createSelf: (name: string | null, palette: PaletteId) => void;
  setVisibility: (v: VisibilityId) => void;
  setMood: (m: Mood | null) => void;
  setCustomText: (t: string | null) => void;
  setPalette: (p: PaletteId) => void;
  setDisplayName: (name: string | null) => void;
  acceptIncomingPresence: (p: PresenceState) => void;
  receiveIncomingPulse: () => void;
  setConnection: (c: Connection | null) => void;
  disconnect: () => void;

  // Dev helper — fakes a paired partner so we can develop the paired UI
  // before the backend is wired up.
  devFakePair: () => void;
};

export const useTwin = create<TwinState>()(
  subscribeWithSelector((set, get) => ({
    hydrated: false,
    self: null,
    ownPresence: blankPresence(),
    connection: null,
    incomingPulseAt: null,

    hydrate() {
      const self = readJSON<SelfProfile | null>(storage, K_SELF, null);
      const own = readJSON<PresenceState>(storage, K_OWN_PRESENCE, blankPresence());
      const conn = readJSON<Connection | null>(storage, K_CONNECTION, null);
      set({ self, ownPresence: own, connection: conn, hydrated: true });
      pushWidget(get());
    },

    createSelf(name, palette) {
      const self: SelfProfile = { id: newId(), displayName: name, palette };
      writeJSON(storage, K_SELF, self);
      set({ self });
      pushWidget(get());
    },

    setVisibility(v) {
      const next = { ...get().ownPresence, visibility: v, setAt: Date.now() };
      writeJSON(storage, K_OWN_PRESENCE, next);
      set({ ownPresence: next });
      pushWidget(get());
    },

    setMood(m) {
      const next = { ...get().ownPresence, mood: m, setAt: Date.now() };
      writeJSON(storage, K_OWN_PRESENCE, next);
      set({ ownPresence: next });
      pushWidget(get());
    },

    setCustomText(t) {
      const trimmed = t == null ? null : t.slice(0, 30);
      const next = { ...get().ownPresence, customText: trimmed, setAt: Date.now() };
      writeJSON(storage, K_OWN_PRESENCE, next);
      set({ ownPresence: next });
      pushWidget(get());
    },

    setPalette(p) {
      const s = get().self;
      if (!s) return;
      const next: SelfProfile = { ...s, palette: p };
      writeJSON(storage, K_SELF, next);
      set({ self: next });
      pushWidget(get());
    },

    setDisplayName(name) {
      const s = get().self;
      if (!s) return;
      const trimmed = name == null ? null : name.trim().slice(0, 24);
      const next: SelfProfile = { ...s, displayName: trimmed && trimmed.length > 0 ? trimmed : null };
      writeJSON(storage, K_SELF, next);
      set({ self: next });
      pushWidget(get());
    },

    acceptIncomingPresence(p) {
      const conn = get().connection;
      if (!conn) return;
      const next: Connection = {
        ...conn,
        partner: { ...conn.partner, presence: p, lastSeenAt: Date.now() },
      };
      writeJSON(storage, K_CONNECTION, next);
      set({ connection: next });
      pushWidget(get());
    },

    receiveIncomingPulse() {
      set({ incomingPulseAt: Date.now() });
    },

    setConnection(c) {
      if (c) {
        writeJSON(storage, K_CONNECTION, c);
      } else {
        storage.remove(K_CONNECTION);
      }
      set({ connection: c });
      pushWidget(get());
    },

    disconnect() {
      storage.remove(K_CONNECTION);
      set({ connection: null });
      pushWidget(get());
    },

    devFakePair() {
      const conn: Connection = {
        id: newId(),
        pairedAt: Date.now(),
        palette: get().self?.palette ?? 'warm',
        partner: {
          id: newId(),
          displayName: 'Sam',
          presence: {
            visibility: 'focusing',
            mood: 'calm',
            customText: 'long meeting',
            setAt: Date.now() - 1000 * 60 * 18,
            expiresAt: null,
          },
          lastSeenAt: Date.now() - 1000 * 60 * 18,
        },
      };
      writeJSON(storage, K_CONNECTION, conn);
      set({ connection: conn });
      pushWidget(get());
    },
  })),
);

function pushWidget(state: TwinState) {
  const snapshot: WidgetSnapshot = {
    self: state.self ? { name: state.self.displayName, palette: state.self.palette } : null,
    own: state.ownPresence,
    partner: state.connection
      ? {
          name: state.connection.partner.displayName,
          palette: state.connection.palette,
          presence: state.connection.partner.presence,
        }
      : null,
    updatedAt: Date.now(),
  };
  writeJSON(widgetStorage, K_WIDGET_SNAPSHOT, snapshot);
  // Fire-and-forget; the helper is a platform-specific no-op on iOS.
  void syncWidget();
}
