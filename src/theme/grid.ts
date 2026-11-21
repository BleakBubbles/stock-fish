/**
 * Sprite grid parsing and atlas layout. Pure and dependency-free so both the
 * app (via src/theme) and the Node build script (scripts/build-sprites.ts)
 * use the same code.
 */

/** Rows of a grid file: comment lines (#) and blank lines dropped. */
export function parseGrid(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((r) => r.trimEnd())
    .filter((r) => r !== '' && !r.startsWith('#'));
}

/**
 * Tail poses for the swimming animation: the tail as drawn ('mid'), and the
 * tail-up / tail-down grids (art/sprites/<body>/tail-*.grid).
 */
export const TAIL_POSES = ['mid', 'up', 'down'] as const;
export type TailPose = (typeof TAIL_POSES)[number];

/** In a tail grid: "keep the face's pixel here" (everything but the tail). */
export const KEEP = '~';

/** A face with a tail pose drawn over it; `tail` undefined means the face's own tail. */
export function withTail(face: readonly string[], tail: readonly string[] | undefined): string[] {
  if (!tail) return [...face];
  if (tail.length !== face.length) throw new Error('Tail grid and face differ in height');
  return face.map((row, y) => {
    const t = tail[y] ?? '';
    if (t.length !== row.length) throw new Error(`Tail grid row ${y} differs in width`);
    let out = '';
    for (let x = 0; x < row.length; x++) out += t[x] === KEEP ? (row[x] ?? '.') : (t[x] ?? '.');
    return out;
  });
}

/**
 * Atlas layers, one row of frames each. Body and fin are white masks tinted
 * at runtime with the fish's colours (white × tint = the exact tint), so any
 * palette colour works without baking every combination.
 */
export const ATLAS_LAYERS = ['fixed', 'body', 'fin', 'highlight'] as const;
export type AtlasLayer = (typeof ATLAS_LAYERS)[number];

/** Grid roles drawn in the fixed layer with their own palette colour. */
export const FIXED_ROLES = ['o', 'p', 'w', 'r'] as const;

export interface AtlasFrameMap {
  frameWidth: number;
  frameHeight: number;
  layers: readonly AtlasLayer[];
  /** "body/face/tail" → column index. Layer L of that frame is at (column × w, L × h). */
  columns: Record<string, number>;
}

export interface AtlasImage {
  width: number;
  height: number;
  /** RGBA, row-major. */
  pixels: Uint8Array;
}

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
}

const WHITE: Rgb = [255, 255, 255];

/**
 * Bake every sprite into a 4-layer atlas. `sprites` maps "body/mood" to grid
 * rows; `fixedColours` gives the hex colour of each fixed role. The highlight
 * layer is a 1-px white ring around the silhouette (8-neighbour), so frames
 * leave room for it: every sprite must keep its outermost row and column
 * clear, which the 32 × 25 canvases do.
 */
export function buildAtlas(
  sprites: Record<string, string[]>,
  fixedColours: Record<(typeof FIXED_ROLES)[number], string>,
): { image: AtlasImage; frames: AtlasFrameMap } {
  const keys = Object.keys(sprites).sort();
  const first = sprites[keys[0] ?? ''];
  if (!first || first.length === 0) throw new Error('No sprites to bake');
  const w = first[0]?.length ?? 0;
  const h = first.length;

  const width = w * keys.length;
  const height = h * ATLAS_LAYERS.length;
  const pixels = new Uint8Array(width * height * 4);
  const put = (x: number, y: number, c: Rgb) => {
    const i = (y * width + x) * 4;
    pixels[i] = c[0];
    pixels[i + 1] = c[1];
    pixels[i + 2] = c[2];
    pixels[i + 3] = 255;
  };
  const fixed = Object.fromEntries(
    Object.entries(fixedColours).map(([role, hex]) => [role, rgb(hex)]),
  ) as Record<string, Rgb>;

  const columns: Record<string, number> = {};
  keys.forEach((key, col) => {
    const rows = sprites[key] ?? [];
    if (rows.length !== h || rows.some((r) => r.length !== w)) {
      throw new Error(`${key}: every sprite must be ${w} × ${h}`);
    }
    columns[key] = col;
    const solid = (x: number, y: number) => (rows[y]?.[x] ?? '.') !== '.';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y]?.[x] ?? '.';
        const ax = col * w + x;
        if (ch === 'B') put(ax, 1 * h + y, WHITE);
        else if (ch === 'F') put(ax, 2 * h + y, WHITE);
        else if (ch !== '.') {
          const c = fixed[ch];
          if (!c)
            throw new Error(`${key}: unknown grid character ${JSON.stringify(ch)} at ${x},${y}`);
          put(ax, y, c);
        }
        if (!solid(x, y)) {
          let ring = false;
          for (let dy = -1; dy <= 1 && !ring; dy++) {
            for (let dx = -1; dx <= 1 && !ring; dx++) ring = solid(x + dx, y + dy);
          }
          if (ring) put(ax, 3 * h + y, WHITE);
        }
      }
    }
  });

  return {
    image: { width, height, pixels },
    frames: { frameWidth: w, frameHeight: h, layers: ATLAS_LAYERS, columns },
  };
}

/**
 * Stretch a frame grid to `width` × `height` (art/decor/frame.grid): the middle
 * column repeats across, and the first row with water ('.') in its middle
 * repeats down. Everything else keeps its exact pixels.
 */
/**
 * Decor colours by grid character (palette.json "decor"). With "decorStyle":
 * "flat", each shade listed in "decorFlat" takes its base character's colour,
 * so plants, rocks, sand and frame have no lighting or shading; "shaded" uses
 * every colour as drawn. Keys starting with _ are notes.
 */
export function decorLegend(palette: {
  decor: Record<string, string>;
  decorStyle?: string;
  decorFlat?: Record<string, string>;
}): Record<string, string> {
  const legend = Object.fromEntries(
    Object.entries(palette.decor).filter(([ch]) => !ch.startsWith('_')),
  );
  if (palette.decorStyle !== 'flat') return legend;
  for (const [ch, base] of Object.entries(palette.decorFlat ?? {})) {
    if (ch.startsWith('_')) continue;
    const hex = legend[base];
    if (!hex) throw new Error(`palette.json decorFlat: no decor colour for ${base}`);
    legend[ch] = hex;
  }
  return legend;
}

export function stretchFrame(rows: readonly string[], width: number, height: number): string[] {
  const w = rows[0]?.length ?? 0;
  const mid = Math.floor(w / 2);
  const repeatRow = rows.findIndex((r) => r[mid] === '.');
  if (w === 0 || repeatRow === -1) throw new Error('Frame grid needs a water row');
  if (rows.some((r) => r.length !== w)) throw new Error('Frame grid rows differ in width');
  const extraX = width - w;
  const extraY = height - rows.length;
  if (extraX < 0 || extraY < 0) throw new Error('Frame grid is larger than the tank');
  const wide = rows.map(
    (r) => r.slice(0, mid) + (r[mid] ?? '.').repeat(extraX + 1) + r.slice(mid + 1),
  );
  const repeated = wide[repeatRow] ?? '';
  return [
    ...wide.slice(0, repeatRow),
    ...Array.from({ length: extraY + 1 }, () => repeated),
    ...wide.slice(repeatRow + 1),
  ];
}

export interface DecorFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Bake decor grids (any sizes) into one image, side by side along the top.
 * Each grid character is drawn in its legend colour; '.' is transparent.
 */
export function buildDecorAtlas(
  grids: Record<string, readonly string[]>,
  legend: Record<string, string>,
): { image: AtlasImage; frames: Record<string, DecorFrame> } {
  const names = Object.keys(grids).sort();
  const frames: Record<string, DecorFrame> = {};
  let x = 0;
  let height = 0;
  for (const name of names) {
    const rows = grids[name] ?? [];
    const w = rows[0]?.length ?? 0;
    if (rows.some((r) => r.length !== w)) throw new Error(`${name}: rows differ in width`);
    frames[name] = { x, y: 0, w, h: rows.length };
    x += w;
    height = Math.max(height, rows.length);
  }
  const width = x;
  const pixels = new Uint8Array(width * height * 4);
  for (const name of names) {
    const f = frames[name];
    if (!f) continue;
    (grids[name] ?? []).forEach((row, y) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i] ?? '.';
        if (ch === '.') continue;
        const hex = legend[ch];
        if (!hex)
          throw new Error(`${name}: unknown decor character ${JSON.stringify(ch)} at ${i},${y}`);
        const c = rgb(hex);
        const p = (y * width + f.x + i) * 4;
        pixels[p] = c[0];
        pixels[p + 1] = c[1];
        pixels[p + 2] = c[2];
        pixels[p + 3] = 255;
      }
    });
  }
  return { image: { width, height, pixels }, frames };
}
