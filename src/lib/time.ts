import type { PresenceState } from '@/domain/types';

// Apply note expiry: a presence whose expiresAt has passed renders without
// its custom text (the note "fades"). Visibility and mood are not auto-
// cleared — only the note is ephemeral.
export function effectivePresence(p: PresenceState, now: number = Date.now()): PresenceState {
  if (p.customText && p.expiresAt && now > p.expiresAt) {
    return { ...p, customText: null, expiresAt: null };
  }
  return p;
}

// Continuous opacity factor for the "blob" based on how stale a state is.
// Encodes Twin's design intent: older states quietly recede, never disappear.
export function ageOpacity(setAt: number, now: number = Date.now()): number {
  const hours = (now - setAt) / (1000 * 60 * 60);
  if (hours < 1) return 1;
  if (hours < 4) return 0.93;
  if (hours < 12) return 0.82;
  if (hours < 36) return 0.7;
  return 0.6;
}

// Twin uses soft, human time. "a little while ago" energy, not "14m".
export function softRelative(epochMs: number, now: number = Date.now()): string {
  const sec = Math.max(0, Math.round((now - epochMs) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 5 * 60) return 'a few moments ago';
  if (sec < 20 * 60) return 'a little while ago';
  if (sec < 60 * 60) return 'within the hour';
  if (sec < 3 * 60 * 60) return 'a couple hours ago';
  if (sec < 8 * 60 * 60) return 'earlier today';
  if (sec < 24 * 60 * 60) return 'today';
  if (sec < 48 * 60 * 60) return 'yesterday';
  if (sec < 7 * 24 * 60 * 60) return 'this week';
  return 'a while ago';
}
