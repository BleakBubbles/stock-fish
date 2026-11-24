/**
 * Make the app icons in public/icons from art/ui/app-icon.grid (32 × 32), each pixel a whole
 * square on the water colour: favicon.png (1×), icon-192.png (6×), icon-512.png (16×), and
 * icon-maskable-512.png (11×, centred, inside the 40% safe circle a launcher may crop to).
 * Run by hand after editing the grid: `npm run icons`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseGrid } from '../src/theme/grid.ts';
import { encodePng } from './png.ts';

const root = new URL('../', import.meta.url);
const palette = JSON.parse(readFileSync(new URL('art/palette.json', root), 'utf8')) as {
  colors: string[];
  ui: { water: string; logo: Record<string, string> };
};
const rows = parseGrid(readFileSync(new URL('art/ui/app-icon.grid', root), 'utf8'));
const n = rows.length;

function rgb(hex: string): [number, number, number] {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function icon(file: string, size: number, scale: number): void {
  const px = new Uint8Array(size * size * 4);
  const water = rgb(palette.ui.water);
  for (let i = 0; i < size * size; i++) px.set([...water, 255], i * 4);
  const offset = Math.floor((size - n * scale) / 2);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const hex = palette.ui.logo[ch];
      if (ch === '.') return;
      if (!hex || !palette.colors.includes(hex))
        throw new Error(`app-icon.grid: no colour for ${ch}`);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((offset + y * scale + dy) * size + offset + x * scale + dx) * 4;
          px.set([...rgb(hex), 255], i);
        }
      }
    });
  });
  writeFileSync(new URL(`public/icons/${file}`, root), encodePng(size, size, px));
  console.log(`icons: ${file} (${size} × ${size}, ${scale}×)`);
}

icon('favicon.png', 32, 1);
icon('icon-192.png', 192, 6);
icon('icon-512.png', 512, 16);
icon('icon-maskable-512.png', 512, 11);
