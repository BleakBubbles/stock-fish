/**
 * Theme layer (CLAUDE.md, firm rule 3). The only module that reads art/.
 * Components get colours, ramps and (later) the sprite atlas from here.
 */
import palette from '../../art/palette.json';

export type Hex = string;

export interface Ramp {
  body: Hex;
  fin: Hex;
}

export interface FishColours {
  primary: Hex;
  secondary: Hex;
}

/** The 32 palette colours, as 6-digit hex without '#'. */
export const colours: readonly Hex[] = palette.colors;

export const ramps: Readonly<Record<string, Ramp>> = palette.ramps;
export const rampOrder: readonly string[] = palette.rampOrder;

export const ui = {
  water: palette.ui.water,
  selectionOutline: palette.ui.selectionOutline,
} as const;

/** '#rrggbb' form for CSS. */
export function css(hex: Hex): string {
  return `#${hex}`;
}

/** 32-bit FNV-1a hash. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const brandPresets = palette.brandPresets as Record<string, Ramp | string>;

/**
 * Default fish colours for a ticker: its brand preset if curated, otherwise a
 * stable hash of the upper-cased symbol picks a ramp.
 */
export function defaultColours(symbol: string): FishColours {
  const key = symbol.trim().toUpperCase();
  const preset = brandPresets[key];
  if (preset && typeof preset === 'object') {
    return { primary: preset.body, secondary: preset.fin };
  }
  const rampName = rampOrder[fnv1a(key) % rampOrder.length];
  const ramp = rampName ? ramps[rampName] : undefined;
  if (!ramp) throw new Error('palette.json has no ramps');
  return { primary: ramp.body, secondary: ramp.fin };
}
