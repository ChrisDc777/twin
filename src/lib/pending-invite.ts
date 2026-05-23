import { storage } from '@/lib/storage';

const KEY = 'pendingInviteToken';

export function setPendingInvite(token: string | null): void {
  if (token) {
    storage.set(KEY, token);
  } else {
    storage.remove(KEY);
  }
}

export function getPendingInvite(): string | null {
  return storage.getString(KEY) ?? null;
}
