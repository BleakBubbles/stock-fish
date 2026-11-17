/**
 * The UI's bitmap font, parsed from art/fonts/*.font. Browsers can't draw
 * TrueType pixel fonts crisply (measured 24–56 % blurred pixels on a 1.5×
 * screen), so all pixel text is drawn glyph by glyph from these grids, like
 * the fish sprites.
 */
import silkscreen from '../../art/fonts/silkscreen.font?raw';

export interface Glyph {
  /** `height` rows of '#' (ink) and '.' (clear); the row width is the advance. */
  rows: string[];
  advance: number;
}

export interface PixelFont {
  /** Rows per glyph. */
  height: number;
  /** Rows above the baseline. */
  baseline: number;
  /** Height of a capital letter in font pixels (H's ink). */
  capHeight: number;
  glyphs: ReadonlyMap<string, Glyph>;
}

export function parseFont(text: string): PixelFont {
  let height = 0;
  let baseline = 0;
  const glyphs = new Map<string, Glyph>();
  let current: { ch: string; rows: string[] } | undefined;

  const finish = () => {
    if (!current) return;
    const { ch, rows } = current;
    if (rows.length !== height)
      throw new Error(`Glyph ${JSON.stringify(ch)}: ${rows.length} rows, expected ${height}`);
    const advance = rows[0]?.length ?? 0;
    if (rows.some((r) => r.length !== advance))
      throw new Error(`Glyph ${JSON.stringify(ch)}: rows differ in width`);
    glyphs.set(ch, { rows, advance });
    current = undefined;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith('//')) continue;
    if (line === '') {
      finish();
      continue;
    }
    const header = /^(height|baseline) (\d+)$/.exec(line);
    if (header) {
      if (header[1] === 'height') height = Number(header[2]);
      else baseline = Number(header[2]);
      continue;
    }
    if (line.startsWith('= ')) {
      finish();
      const name = line.slice(2);
      current = { ch: name === 'space' ? ' ' : name, rows: [] };
      continue;
    }
    if (!current || !/^[#.]+$/.test(line))
      throw new Error(`Unexpected line in font: ${JSON.stringify(line)}`);
    current.rows.push(line);
  }
  finish();

  if (!height || !glyphs.has(' ')) throw new Error('Font needs a height and a space glyph');
  const h = glyphs.get('H');
  const capHeight = h ? h.rows.filter((r) => r.includes('#')).length : height;
  return { height, baseline, capHeight, glyphs };
}

export const uiFont: PixelFont = parseFont(silkscreen);

/** Characters the font lacks, mapped to ones it has. Anything else becomes '?'. */
const SUBSTITUTES = new Map<number, string>([
  [0x00a0, ' '], // no-break space (some locales' currency formats)
  [0x202f, ' '], // narrow no-break space
  [0x2009, ' '], // thin space
  [0x2212, '-'], // minus sign
  [0x2010, '-'], // hyphen
  [0x2011, '-'], // non-breaking hyphen
  [0x2018, "'"], // left single quote
  [0x2019, "'"], // right single quote
  [0x201c, '"'], // left double quote
  [0x201d, '"'], // right double quote
]);

/** Replace characters the font can't draw. */
export function normalizeText(font: PixelFont, text: string): string {
  let out = '';
  for (const ch of text) {
    if (font.glyphs.has(ch)) out += ch;
    else {
      const sub = SUBSTITUTES.get(ch.codePointAt(0) ?? 0);
      out += sub !== undefined && font.glyphs.has(sub) ? sub : '?';
    }
  }
  return out;
}

/** Width in font pixels of already-normalised text. */
export function measureText(font: PixelFont, text: string): number {
  let w = 0;
  for (const ch of text) w += font.glyphs.get(ch)?.advance ?? 0;
  return w;
}

/**
 * Break normalised text into lines no wider than `maxWidth` font pixels, at
 * spaces where possible; a single word longer than a line is split.
 */
export function wrapText(font: PixelFont, text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(font, candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Split a word that can't fit on a line of its own.
      let rest = word;
      while (measureText(font, rest) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measureText(font, rest.slice(0, cut)) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Draw normalised text with its top-left at (x, y) in a context whose pixels
 * are font pixels. Returns the width drawn.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  font: PixelFont,
  text: string,
  x: number,
  y: number,
  colour: string,
): number {
  ctx.fillStyle = colour;
  let cx = x;
  for (const ch of text) {
    const glyph = font.glyphs.get(ch);
    if (!glyph) continue;
    glyph.rows.forEach((row, gy) => {
      // Merge runs of ink into one rectangle per run.
      let start = -1;
      for (let gx = 0; gx <= row.length; gx++) {
        const ink = row[gx] === '#';
        if (ink && start < 0) start = gx;
        if (!ink && start >= 0) {
          ctx.fillRect(cx + start, y + gy, gx - start, 1);
          start = -1;
        }
      }
    });
    cx += glyph.advance;
  }
  return cx - x;
}
