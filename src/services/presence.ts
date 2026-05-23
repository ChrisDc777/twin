import { supabase } from '@/lib/supabase';
import { currentUserId } from '@/services/auth';
import { decryptFromPartner, encryptForPartner, hasPartnerKey } from '@/lib/crypto';
import type { Mood, PresenceState, VisibilityId } from '@/domain/types';

export type PresenceRow = {
  user_id: string;
  visibility: VisibilityId;
  mood: Mood | null;
  custom_text: string | null;
  set_at: string;
  expires_at: string | null;
};

// When paired, we always encrypt custom_text. If for some reason we don't
// have a derived key yet (key still being fetched), drop custom_text to
// avoid leaking plaintext to the server. Unpaired users can write plaintext
// — only they can read it.
export async function writeOwnPresence(
  p: PresenceState,
  partnerId: string | null,
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  let custom_text: string | null = p.customText;
  if (custom_text && partnerId) {
    if (hasPartnerKey(partnerId)) {
      custom_text = encryptForPartner(partnerId, custom_text);
    } else {
      custom_text = null;
    }
  }

  const { error } = await supabase.from('presence').upsert({
    user_id: userId,
    visibility: p.visibility,
    mood: p.mood,
    custom_text,
    set_at: new Date(p.setAt).toISOString(),
    expires_at: p.expiresAt ? new Date(p.expiresAt).toISOString() : null,
  });
  if (error) throw error;
}

export async function readPartnerPresence(partnerId: string): Promise<PresenceRow | null> {
  const { data, error } = await supabase
    .from('presence')
    .select('*')
    .eq('user_id', partnerId)
    .maybeSingle();
  if (error) throw error;
  return (data as PresenceRow | null) ?? null;
}

export function rowToPresence(row: PresenceRow, partnerId: string | null = null): PresenceState {
  let customText = row.custom_text;
  if (customText && partnerId) {
    const decrypted = decryptFromPartner(partnerId, customText);
    customText = decrypted; // null if decryption fails — show empty rather than ciphertext garbage
  }
  return {
    visibility: row.visibility,
    mood: row.mood,
    customText,
    setAt: new Date(row.set_at).getTime(),
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
  };
}

export function subscribePartnerPresence(
  partnerId: string,
  onChange: (row: PresenceRow) => void,
): () => void {
  const channel = supabase
    .channel(`presence:${partnerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'presence',
        filter: `user_id=eq.${partnerId}`,
      },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          onChange(payload.new as PresenceRow);
        }
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function sendPulse(connectionId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('reactions')
    .insert({ connection_id: connectionId, from_user: userId, kind: 'pulse' });
  if (error) throw error;
}

export function subscribePulses(
  connectionId: string,
  onPulse: () => void,
): () => void {
  const channel = supabase
    .channel(`reactions:${connectionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'reactions',
        filter: `connection_id=eq.${connectionId}`,
      },
      () => onPulse(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
