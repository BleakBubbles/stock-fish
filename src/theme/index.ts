/**
 * Theme layer (CLAUDE.md, firm rule 3). The only module that reads art/.
 * Components get colours, ramps and sprites from here.
 */
import palette from '../../art/palette.json';

/** Hex colour without '#'. */
export type Hex = string;

export interface Ramp {
  body: Hex;
  fin: Hex;
}

export interface FishColours {
  primary: Hex;
  secondary: Hex;
}

/** The 32 palette colours, as 6-digit lower-case hex without '#'. */
export const colours: readonly Hex[] = palette.colors;

export const ramps: Readonly<Record<string, Ramp>> = palette.ramps;
export const rampOrder: readonly string[] = palette.rampOrder;

export const ui = {
  water: palette.ui.water,
  selectionOutline: palette.ui.selectionOutline,
  panel: palette.ui.panel,
  border: palette.ui.border,
  text: palette.ui.text,
  textMuted: palette.ui.textMuted,
  button: palette.ui.button,
  buttonText: palette.ui.buttonText,
  focus: palette.ui.focus,
  warning: palette.ui.warning,
  success: palette.ui.success,
  /** Tank overlay when the market is closed (the light is off). */
  night: palette.ui.night,
} as const;

/** '#rrggbb' form for CSS and PixiJS. */
export function css(hex: Hex): string {
  return `#${hex}`;
}

export function isPaletteColour(hex: string): boolean {
  return colours.includes(hex.toLowerCase());
}

const roles = palette.roles as Record<string, { color: string | null }>;

/** Fixed colour of a sprite role (o, p, w, r). Body and fin colours come from the fish. */
export function roleColour(role: 'o' | 'p' | 'w' | 'r'): Hex {
  const colour = roles[role]?.color;
  if (!colour) throw new Error(`palette.json has no colour for role ${role}`);
  return colour;
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
 * stable hash of the upper-cased symbol picks a ramp. Community and shared
 * views always use these, never a user's choice.
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

/** The colours a fish is drawn with: the user's choice per slot, else the default. */
export function fishColours(fish: { symbol: string; primary?: Hex; secondary?: Hex }): FishColours {
  const fallback = defaultColours(fish.symbol);
  return {
    primary: fish.primary ?? fallback.primary,
    secondary: fish.secondary ?? fallback.secondary,
  };
}
