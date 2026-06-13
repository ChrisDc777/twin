// One-off WCAG contrast audit for the Twin palettes.
// Run: node scripts/contrast-audit.mjs
// Not part of the app bundle — a dev tool for issue #12.

const PALETTES = {
  warm:   { bg: ['#1a0f0c', '#2a1714'], text: '#f9ece4', textMuted: '#b39080', accent: '#ffb89a' },
  cool:   { bg: ['#0c1218', '#141c25'], text: '#e7eef5', textMuted: '#8a9aac', accent: '#a8c5e6' },
  dusk:   { bg: ['#15101a', '#211827'], text: '#f0e7f6', textMuted: '#a294b0', accent: '#d0a4ee' },
  forest: { bg: ['#0d130e', '#161e17'], text: '#e6efe4', textMuted: '#8a9c8a', accent: '#aed1a0' },
  ember:  { bg: ['#180a09', '#241211'], text: '#fde6df', textMuted: '#b07a6c', accent: '#ff9d7d' },
  mist:   { bg: ['#0f1316', '#161b1f'], text: '#eaeff2', textMuted: '#9aa6ad', accent: '#d6e0e6' },
  sage:   { bg: ['#10130f', '#181c15'], text: '#ecf0e3', textMuted: '#9aa388', accent: '#cad9aa' },
  plum:   { bg: ['#130a13', '#1f111e'], text: '#f1e3ec', textMuted: '#a78cae', accent: '#b66fa3' },
};

function lin(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// We render text on a vertical gradient; the brighter (second) bg stop is the
// harder background for contrast, so audit against bg[1].
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;
let worst = Infinity;
for (const [name, p] of Object.entries(PALETTES)) {
  const bg = p.bg[1];
  const rows = [
    ['text', p.text],
    ['textMuted', p.textMuted],
    ['accent', p.accent],
  ].map(([k, c]) => {
    const r = ratio(c, bg);
    worst = Math.min(worst, r);
    const flag = r >= AA_NORMAL ? 'AA' : r >= AA_LARGE ? 'AA-large' : 'FAIL';
    return `${k.padEnd(10)} ${c}  ${r.toFixed(2)}  ${flag}`;
  });
  console.log(`\n${name}  (bg ${bg})`);
  rows.forEach((r) => console.log('  ' + r));
}
console.log(`\nworst ratio across all palettes: ${worst.toFixed(2)}`);
