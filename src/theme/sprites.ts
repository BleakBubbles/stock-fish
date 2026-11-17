/**
 * Sprite grids from art/sprites, loaded as text at build time. This is the
 * parsing half of the sprite pipeline; scripts/build-sprites.ts (milestone 4)
 * will bake the same grids into an atlas for the tank.
 */
import { MOODS, type Mood } from '../mood/types';
import { type Hex, roleColour } from './index';

export const BODIES = [1, 2, 3, 4, 5, 6] as const;
export type Body = (typeof BODIES)[number];

export const SPRITE_WIDTH = 32;
export const SPRITE_HEIGHT = 25;

/** Roles a grid may use (art/STYLE.md legend). */
export const ROLES = ['.', 'o', 'p', 'w', 'r', 'B', 'F'] as const;
export type Role = (typeof ROLES)[number];

const files = import.meta.glob('../../art/sprites/*/*.grid', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Rows of a grid file: comment lines (#) and blank lines dropped. */
export function parseGrid(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((r) => r.trimEnd())
    .filter((r) => r !== '' && !r.startsWith('#'));
}

const sprites = new Map<string, string[]>();
for (const [path, text] of Object.entries(files)) {
  const match = /sprites\/(\d)-[^/]+\/(\w+)\.grid$/.exec(path);
  if (match) sprites.set(`${match[1]}/${match[2]}`, parseGrid(text));
}

export function getSprite(body: Body, mood: Mood): string[] {
  const rows = sprites.get(`${body}/${mood}`);
  if (!rows) throw new Error(`Missing sprite for body ${body}, mood ${mood}`);
  return rows;
}

/** Every body × mood pair, for checks and atlas building. */
export function allSprites(): { body: Body; mood: Mood; rows: string[] }[] {
  return BODIES.flatMap((body) =>
    MOODS.map((mood) => ({ body, mood, rows: getSprite(body, mood) })),
  );
}

/** Colour for each grid role, given the fish's body and fin colours. */
export function spriteColours(primary: Hex, secondary: Hex): Record<Exclude<Role, '.'>, Hex> {
  return {
    o: roleColour('o'),
    p: roleColour('p'),
    w: roleColour('w'),
    r: roleColour('r'),
    B: primary,
    F: secondary,
  };
}
