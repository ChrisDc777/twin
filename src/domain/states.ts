import type { Mood, VisibilityId } from './types';

export type VisibilityMeta = {
  id: VisibilityId;
  label: string;
  hint: string;
  glyph: string;
};

export const VISIBILITY: Record<VisibilityId, VisibilityMeta> = {
  visible:  { id: 'visible',  label: 'Around',         hint: 'Here and open',                         glyph: '○' },
  busy:     { id: 'busy',     label: 'Busy',           hint: 'Around but heads-down',                 glyph: '◐' },
  focusing: { id: 'focusing', label: 'Focusing',       hint: 'Deep work, soft do-not-disturb',        glyph: '◍' },
  sleeping: { id: 'sleeping', label: 'Sleeping',       hint: 'Off the grid until morning',            glyph: '☾' },
  hidden:   { id: 'hidden',   label: 'Hidden',         hint: 'Choosing not to share right now',       glyph: '◯' },
  dnd:      { id: 'dnd',      label: 'Do not disturb', hint: 'No pulses, please',                     glyph: '●' },
};

export const VISIBILITY_ORDER: VisibilityId[] = ['visible', 'busy', 'focusing', 'sleeping', 'hidden', 'dnd'];

export type MoodMeta = { id: Mood; emoji: string; label: string };

export const MOODS: Record<Mood, MoodMeta> = {
  calm:     { id: 'calm',     emoji: '🌿', label: 'Calm' },
  happy:    { id: 'happy',    emoji: '☀️', label: 'Happy' },
  tired:    { id: 'tired',    emoji: '🌙', label: 'Tired' },
  cozy:     { id: 'cozy',     emoji: '🫧', label: 'Cozy' },
  lonely:   { id: 'lonely',   emoji: '🌧️', label: 'Lonely' },
  excited:  { id: 'excited',  emoji: '✨', label: 'Excited' },
  thinking: { id: 'thinking', emoji: '💭', label: 'Thinking' },
  love:     { id: 'love',     emoji: '💗', label: 'Love' },
};

export const MOOD_ORDER: Mood[] = ['calm', 'happy', 'cozy', 'love', 'excited', 'thinking', 'tired', 'lonely'];
