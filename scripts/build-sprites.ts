/**
 * Build the tank's sprite atlas from art/sprites/*.grid (the Node port of
 * art/tools/grid2png.py), so the app build doesn't depend on Python.
 *
 * Writes src/theme/generated/atlas.png and atlas.json (gitignored). Runs
 * automatically before dev, build, typecheck and test; run it by hand with
 * `npm run sprites`.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { FIXED_ROLES, buildAtlas, parseGrid } from '../src/theme/grid.ts';
import { encodePng } from './png.ts';

const root = new URL('../', import.meta.url);
const spritesDir = new URL('art/sprites/', root);
const outDir = new URL('src/theme/generated/', root);

const palette = JSON.parse(readFileSync(new URL('art/palette.json', root), 'utf8')) as {
  roles: Record<string, { color: string | null }>;
};

const sprites: Record<string, string[]> = {};
for (const folder of readdirSync(spritesDir, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const body = /^(\d)-/.exec(folder.name)?.[1];
  if (!body) continue;
  for (const file of readdirSync(new URL(`${folder.name}/`, spritesDir))) {
    if (!file.endsWith('.grid')) continue;
    const mood = file.slice(0, -'.grid'.length);
    const text = readFileSync(new URL(`${folder.name}/${file}`, spritesDir), 'utf8');
    sprites[`${body}/${mood}`] = parseGrid(text);
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
