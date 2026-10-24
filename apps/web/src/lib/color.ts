/** Ajudantes de cor do protótipo (hexToRgb, mix, tint). */

export const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mistura a cor `h` com `t` (peso 0 a 1). Ex.: mix(cor, '#ffffff', .5) clareia. */
export const mix = (h: string, t: string, w: number) => {
  const a = hexToRgb(h);
  const b = hexToRgb(t);
  return '#' + a.map((v, i) => Math.round(v + (b[i]! - v) * w).toString(16).padStart(2, '0')).join('');
};

/** A cor com transparência: tint('#ef4444', .12). */
export const tint = (h: string, a: number) => {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
};
