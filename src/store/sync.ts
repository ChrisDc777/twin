import {
  clearAllPartnerKeys,
  forgetPartnerKey,
  getMyPublicKey,
  setPartnerKey,
} from '@/lib/crypto';
import { isSupabaseConfigured } from '@/lib/supabase';
import { currentUserId, ensureAnonymousAuth } from '@/services/auth';
import {
  getMyConnection,
  getPartnerProfile,
  subscribeConnections,
  upsertProfile,
} from '@/services/connection';
import {
  readPartnerPresence,
  rowToPresence,
  subscribePartnerPresence,
  subscribePulses,
  writeOwnPresence,
} from '@/services/presence';
import { useTwin } from '@/store/twin';
import type { Connection } from '@/domain/types';

let started = false;
let unsubPartnerPresence: (() => void) | null = null;
let unsubPulses: (() => void) | null = null;
let unsubConnections: (() => void) | null = null;
let unsubOwnPresence: (() => void) | null = null;
let unsubSelf: (() => void) | null = null;

// Current partner id, used by ownPresence subscriber to know whom to
// encrypt for. Synced with the store's connection.partner.id.
let currentPartnerId: string | null = null;

export async function startSync(): Promise<void> {
  if (started) return;
  if (!isSupabaseConfigured()) return;
  started = true;

  try {
    await ensureAnonymousAuth();
    await syncFromCloud();

    unsubOwnPresence = useTwin.subscribe(
      (s) => s.ownPresence,
      (own) => {
        void writeOwnPresence(own, currentPartnerId).catch(() => {});
      },
    );

    unsubSelf = useTwin.subscribe(
      (s) => s.self,
      (self) => {
        if (!self) return;
        void upsertProfile(self.displayName, self.palette, getMyPublicKey()).catch(() => {});
      },
    );

    unsubConnections = subscribeConnections(() => {
      void syncFromCloud();
    });
  } catch (e) {
    console.warn('[twin] sync init failed', e);
    started = false;
  }
}

export async function syncFromCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const myId = await currentUserId();
  if (!myId) return;

  // Mirror our local self up (with our public key so the partner can derive
  // the shared secret).
  const self = useTwin.getState().self;
  if (self) {
    await upsertProfile(self.displayName, self.palette, getMyPublicKey()).catch(() => {});
  }

  const conn = await getMyConnection().catch(() => null);
  if (!conn) {
    if (currentPartnerId) {
      forgetPartnerKey(currentPartnerId);
      currentPartnerId = null;
    }
    if (useTwin.getState().connection) {
      useTwin.getState().setConnection(null);
    }
    teardownPartnerSubs();
    // No partner — push our presence as plaintext (only we can read it).
    const ownPresence = useTwin.getState().ownPresence;
    await writeOwnPresence(ownPresence, null).catch(() => {});
    return;
  }

  const partnerId = conn.user_a === myId ? conn.user_b : conn.user_a;
  const [partnerProfile, partnerPresence] = await Promise.all([
    getPartnerProfile(partnerId).catch(() => null),
    readPartnerPresence(partnerId).catch(() => null),
  ]);

  // Derive shared key before pushing our presence — guarantees the first
  // write after pair is already encrypted.
  if (partnerProfile?.public_key) {
    setPartnerKey(partnerId, partnerProfile.public_key);
  } else {
    forgetPartnerKey(partnerId);
  }
  currentPartnerId = partnerId;

  // Now safe to push our presence encrypted.
  const ownPresence = useTwin.getState().ownPresence;
  await writeOwnPresence(ownPresence, partnerId).catch(() => {});

  const remote: Connection = {
    id: conn.id,
    pairedAt: new Date(conn.paired_at).getTime(),
    palette: conn.palette,
    partner: {
      id: partnerId,
      displayName: partnerProfile?.display_name ?? null,
      presence: partnerPresence
        ? rowToPresence(partnerPresence, partnerId)
        : {
            visibility: 'visible',
            mood: null,
            customText: null,
            setAt: 0,
            expiresAt: null,
          },
      lastSeenAt: Date.now(),
    },
  };

  useTwin.getState().setConnection(remote);

  teardownPartnerSubs();
  unsubPartnerPresence = subscribePartnerPresence(partnerId, (row) => {
    const s = useTwin.getState();
    if (!s.connection) return;
    // Route through setConnection so MMKV + widget mirror also get updated.
    s.setConnection({
      ...s.connection,
      partner: {
        ...s.connection.partner,
        presence: rowToPresence(row, partnerId),
        lastSeenAt: Date.now(),
      },
    });
  });

  unsubPulses = subscribePulses(conn.id, () => {
    useTwin.getState().receiveIncomingPulse();
  });
}

function teardownPartnerSubs(): void {
  unsubPartnerPresence?.();
  unsubPartnerPresence = null;
  unsubPulses?.();
  unsubPulses = null;
}

export function stopSync(): void {
  teardownPartnerSubs();
  unsubConnections?.();
  unsubConnections = null;
  unsubOwnPresence?.();
  unsubOwnPresence = null;
  unsubSelf?.();
  unsubSelf = null;
  clearAllPartnerKeys();
  currentPartnerId = null;
  started = false;
}
