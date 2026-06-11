import { ensureKeypair } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';

export async function ensureAnonymousAuth(): Promise<string> {
  // Generate our crypto keypair eagerly so the public key is ready
  // by the time the first profile upsert runs.
  ensureKeypair();

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw error ?? new Error('anonymous auth failed');
  }
  return data.user.id;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// Deletes the auth.users row server-side; FK cascades remove profile,
// presence, device tokens, reactions, connections, and invites. The
// partner sees the connection disappear via the existing realtime path.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  await supabase.auth.signOut().catch(() => {});
}
