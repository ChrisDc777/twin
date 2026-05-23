import type { PaletteId } from './types';

type Hex = `#${string}`;

export type Palette = {
  id: PaletteId;
  label: string;
  bg: [Hex, Hex];
  blob: [Hex, Hex];
  text: Hex;
  textMuted: Hex;
  accent: Hex;
};

export const PALETTES: Record<PaletteId, Palette> = {
  warm: {
    id: 'warm', label: 'Warm',
    bg:   ['#1a0f0c', '#2a1714'],
    blob: ['#f4a98c', '#d97757'],
    text: '#f9ece4', textMuted: '#b39080', accent: '#ffb89a',
  },
  cool: {
    id: 'cool', label: 'Cool',
    bg:   ['#0c1218', '#141c25'],
    blob: ['#8fb4d8', '#5e85b3'],
    text: '#e7eef5', textMuted: '#8a9aac', accent: '#a8c5e6',
  },
  dusk: {
    id: 'dusk', label: 'Dusk',
    bg:   ['#15101a', '#211827'],
    blob: ['#c69ae2', '#8a5fb0'],
    text: '#f0e7f6', textMuted: '#a294b0', accent: '#d0a4ee',
  },
  forest: {
    id: 'forest', label: 'Forest',
    bg:   ['#0d130e', '#161e17'],
    blob: ['#9bc28b', '#5f8f5a'],
    text: '#e6efe4', textMuted: '#8a9c8a', accent: '#aed1a0',
  },
  ember: {
    id: 'ember', label: 'Ember',
    bg:   ['#180a09', '#241211'],
    blob: ['#ff8769', '#c0432a'],
    text: '#fde6df', textMuted: '#b07a6c', accent: '#ff9d7d',
  },
  mist: {
    id: 'mist', label: 'Mist',
    bg:   ['#0f1316', '#161b1f'],
    blob: ['#c8d4dc', '#94a4ad'],
    text: '#eaeff2', textMuted: '#9aa6ad', accent: '#d6e0e6',
  },
  sage: {
    id: 'sage', label: 'Sage',
    bg:   ['#10130f', '#181c15'],
    blob: ['#bdcd9f', '#8a9a6e'],
    text: '#ecf0e3', textMuted: '#9aa388', accent: '#cad9aa',
  },
  plum: {
    id: 'plum', label: 'Plum',
    bg:   ['#130a13', '#1f111e'],
    blob: ['#a05b8d', '#673a5d'],
    text: '#f1e3ec', textMuted: '#a78cae', accent: '#b66fa3',
  },
};

export const PALETTE_ORDER: PaletteId[] = ['warm', 'ember', 'cool', 'mist', 'dusk', 'plum', 'forest', 'sage'];
