/**
 * Sprite grids from art/sprites, loaded as text at build time. The React UI
 * uses them for small canvas previews; scripts/build-sprites.ts bakes the
 * same grids into the tank's atlas (see ./atlas.ts).
 */
import { MOODS, type Mood } from '../mood/types';
import { TAIL_POSES, type TailPose, parseGrid, withTail } from './grid';
import logoText from '../../art/ui/logo.grid?raw';
import { type Hex, roleColour } from './index';

export const BODIES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Body = (typeof BODIES)[number];

/** What a fish's face shows: its mood, or asleep while the market is closed. */
export const FACES = [...MOODS, 'sleeping'] as const;
export type Face = (typeof FACES)[number];

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

const sprites = new Map<string, string[]>();
for (const [path, text] of Object.entries(files)) {
  const match = /sprites\/(\d)-[^/]+\/([\w-]+)\.grid$/.exec(path);
  if (match) sprites.set(`${match[1]}/${match[2]}`, parseGrid(text));
}

/** One frame: a body's face with a tail pose ('mid' is the tail as drawn). */
export function getSprite(body: Body, face: Face | Mood, tail: TailPose = 'mid'): string[] {
  const rows = sprites.get(`${body}/${face}`);
  if (!rows) throw new Error(`Missing sprite for body ${body}, face ${face}`);
  if (tail === 'mid') return rows;
  const pose = sprites.get(`${body}/tail-${tail}`);
  if (!pose) throw new Error(`Missing tail-${tail} grid for body ${body}`);
  return withTail(rows, pose);
}

/** Every body × face × tail frame, for checks. */
export function allSprites(): { body: Body; face: Face; tail: TailPose; rows: string[] }[] {
  return BODIES.flatMap((body) =>
    FACES.flatMap((face) =>
      TAIL_POSES.map((tail) => ({ body, face, tail, rows: getSprite(body, face, tail) })),
    ),
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

/** The title-bar logo (art/ui/logo.grid): a small fish in the sprite roles. */
export const LOGO: readonly string[] = parseGrid(logoText);

const iconFiles = import.meta.glob('../../art/ui/icons/*.grid', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Button icons (art/ui/icons): 7 × 7 grids, 'x' for ink ('#' starts a comment). */
export const ICONS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(iconFiles).map(([path, text]) => [
    /([\w-]+)\.grid$/.exec(path)?.[1] ?? path,
    parseGrid(text),
  ]),
);
