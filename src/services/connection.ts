import { supabase } from '@/lib/supabase';
import { currentUserId } from '@/services/auth';
import type { PaletteId } from '@/domain/types';

export type InviteRow = {
  token: string;
  short_code: string | null;
  display_name: string | null;
  palette: PaletteId;
  expires_at: string;
};

export type ConnectionRow = {
  id: string;
  user_a: string;
  user_b: string;
  palette: PaletteId;
  paired_at: string;
};

export async function upsertProfile(
  displayName: string | null,
  palette: PaletteId,
  publicKey?: string,
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('not signed in');
  const row: Record<string, unknown> = {
    user_id: userId,
    display_name: displayName,
    palette,
  };
  if (publicKey) row.public_key = publicKey;
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) throw error;
}

export async function createInvite(
  displayName: string | null,
  palette: PaletteId,
  publicKey?: string,
): Promise<InviteRow> {
  // RPC generates a collision-free short code atomically and stamps
  // from_user = auth.uid() server-side.
  const { data, error } = await supabase.rpc('create_invite', {
    p_display_name: displayName,
    p_palette: palette,
    p_public_key: publicKey ?? null,
  });
  if (error || !data) throw error ?? new Error('invite creation failed');
  return data as InviteRow;
}

export async function previewInvite(token: string): Promise<InviteRow | null> {
  const { data, error } = await supabase
    .from('invites')
    .select('token, short_code, display_name, palette, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  return (data as InviteRow | null) ?? null;
}

export async function previewInviteByCode(code: string): Promise<InviteRow | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from('invites')
    .select('token, short_code, display_name, palette, expires_at')
    .eq('short_code', normalized)
    .maybeSingle();
  if (error) throw error;
  return (data as InviteRow | null) ?? null;
}

export async function acceptInvite(token: string): Promise<ConnectionRow> {
  const { data, error } = await supabase.rpc('accept_invite', { token });
  if (error || !data) throw error ?? new Error('accept_invite failed');
  return data as ConnectionRow;
}

export async function acceptInviteByCode(code: string): Promise<ConnectionRow> {
  const { data, error } = await supabase.rpc('accept_invite_by_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error || !data) throw error ?? new Error('accept_invite_by_code failed');
  return data as ConnectionRow;
}

export async function getMyConnection(): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ConnectionRow | null) ?? null;
}

export async function getPartnerProfile(partnerId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, palette, public_key')
    .eq('user_id', partnerId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | { user_id: string; display_name: string | null; palette: PaletteId; public_key: string | null }
    | null;
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const { error } = await supabase.from('connections').delete().eq('id', connectionId);
  if (error) throw error;
}

export function subscribeConnections(onChange: () => void) {
  const channel = supabase
    .channel('connections:me')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'connections' },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
