export type VisibilityId =
  | 'visible'
  | 'busy'
  | 'focusing'
  | 'sleeping'
  | 'hidden'
  | 'dnd';

export type Mood =
  | 'calm'
  | 'happy'
  | 'tired'
  | 'cozy'
  | 'lonely'
  | 'excited'
  | 'thinking'
  | 'love';

export type PaletteId =
  | 'warm'
  | 'cool'
  | 'dusk'
  | 'forest'
  | 'ember'
  | 'mist'
  | 'sage'
  | 'plum';

export type PresenceState = {
  visibility: VisibilityId;
  mood: Mood | null;
  customText: string | null;
  setAt: number;
  expiresAt: number | null;
};

export type SelfProfile = {
  id: string;
  displayName: string | null;
  palette: PaletteId;
};

export type Partner = {
  id: string;
  displayName: string | null;
  presence: PresenceState;
  lastSeenAt: number;
};

export type Connection = {
  id: string;
  pairedAt: number;
  palette: PaletteId;
  partner: Partner;
};

export type WidgetSnapshot = {
  self: { name: string | null; palette: PaletteId } | null;
  own: PresenceState;
  partner: { name: string | null; palette: PaletteId; presence: PresenceState } | null;
  updatedAt: number;
};
