/**
 * Build the tank's sprite atlas from art/sprites/*.grid (the Node port of
 * art/tools/grid2png.py), so the app build doesn't depend on Python.
 *
 * Writes src/theme/generated/atlas.png and atlas.json (fish), and decor.png and
 * decor.json (art/decor: plants, rocks and the tank frame) (gitignored). Runs
 * automatically before dev, build, typecheck and test; run it by hand with
 * `npm run sprites`.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import {
  FIXED_ROLES,
  TAIL_POSES,
  buildAtlas,
  buildDecorAtlas,
  parseGrid,
  stretchFrame,
  withTail,
} from '../src/theme/grid.ts';
import { TANK_HEIGHT, TANK_WIDTH } from '../src/tank/constants.ts';
import { encodePng } from './png.ts';

const root = new URL('../', import.meta.url);
const spritesDir = new URL('art/sprites/', root);
const outDir = new URL('src/theme/generated/', root);

const palette = JSON.parse(readFileSync(new URL('art/palette.json', root), 'utf8')) as {
  colors: string[];
  roles: Record<string, { color: string | null }>;
  decor: Record<string, string>;
};

// Each body folder has faces (the moods and "sleeping") and tail poses
// (tail-up, tail-down). Every face is baked with every tail pose.
const sprites: Record<string, string[]> = {};
for (const folder of readdirSync(spritesDir, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const body = /^(\d)-/.exec(folder.name)?.[1];
  if (!body) continue;
  const grids = new Map<string, string[]>();
  for (const file of readdirSync(new URL(`${folder.name}/`, spritesDir))) {
    if (!file.endsWith('.grid')) continue;
    const text = readFileSync(new URL(`${folder.name}/${file}`, spritesDir), 'utf8');
    grids.set(file.slice(0, -'.grid'.length), parseGrid(text));
  }
  for (const [face, rows] of grids) {
    if (face.startsWith('tail-')) continue;
    for (const pose of TAIL_POSES) {
      const tail = pose === 'mid' ? undefined : grids.get(`tail-${pose}`);
      if (pose !== 'mid' && !tail) throw new Error(`${folder.name}: missing tail-${pose}.grid`);
      sprites[`${body}/${face}/${pose}`] = withTail(rows, tail);
    }
  }
}

const fixedColours = Object.fromEntries(
  FIXED_ROLES.map((role) => {
    const colour = palette.roles[role]?.color;
    if (!colour) throw new Error(`palette.json has no colour for role ${role}`);
    return [role, colour];
  }),
) as Record<(typeof FIXED_ROLES)[number], string>;

const { image, frames } = buildAtlas(sprites, fixedColours);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL('atlas.png', outDir), encodePng(image.width, image.height, image.pixels));
writeFileSync(new URL('atlas.json', outDir), JSON.stringify(frames, null, 1) + '\n');
console.log(
  `sprites: ${Object.keys(frames.columns).length} frames → src/theme/generated/atlas.png ` +
    `(${image.width} × ${image.height})`,
);

// Decor: every grid in art/decor at its own size; the frame stretched to the tank.
const decorDir = new URL('art/decor/', root);
const decorGrids: Record<string, string[]> = {};
for (const file of readdirSync(decorDir)) {
  if (!file.endsWith('.grid')) continue;
  const name = file.slice(0, -'.grid'.length);
  const rows = parseGrid(readFileSync(new URL(file, decorDir), 'utf8'));
  decorGrids[name] = name === 'frame' ? stretchFrame(rows, TANK_WIDTH, TANK_HEIGHT) : rows;
}
const legend = Object.fromEntries(
  Object.entries(palette.decor).filter(([ch]) => !ch.startsWith('_')),
);
for (const [ch, hex] of Object.entries(legend)) {
  if (!palette.colors.includes(hex))
    throw new Error(`palette.json decor ${ch}: ${hex} isn't a palette colour`);
}
const decor = buildDecorAtlas(decorGrids, legend);
writeFileSync(
  new URL('decor.png', outDir),
  encodePng(decor.image.width, decor.image.height, decor.image.pixels),
);
writeFileSync(new URL('decor.json', outDir), JSON.stringify(decor.frames, null, 1) + '\n');
console.log(
  `sprites: ${Object.keys(decor.frames).length} decor frames → src/theme/generated/decor.png ` +
    `(${decor.image.width} × ${decor.image.height})`,
);
