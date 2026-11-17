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
  /** "body/mood" → column index. Layer L of that frame is at (column × w, L × h). */
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
