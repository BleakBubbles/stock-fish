import { useLayoutEffect, useRef } from 'react';
import { css, ui } from '../../theme';
import { ICONS } from '../../theme/sprites';
import { TONE_COLOUR, type Tone } from './tones';

/** The icons in art/ui/icons. */
export type IconName =
  | 'group'
  | 'sleep'
  | 'back'
  | 'check'
  | 'close'
  | 'colours'
  | 'delete'
  | 'edit'
  | 'export'
  | 'forward'
  | 'holdings'
  | 'all'
  | 'import'
  | 'plus'
  | 'settings'
  | 'show'
  | 'tank'
  | 'test'
  | 'up'
  | 'down'
  | 'sunny'
  | 'fair'
  | 'calm'
  | 'rainy'
  | 'stormy'
  | 'sort';

const SIZE = 7;
/** The font's line is 9 pixels tall with capitals on rows 3 to 7: two rows down centres a 7-pixel icon on them. */
const LINE_HEIGHT = 9;
const TOP = 2;

/** A 7 × 7 pixel icon on a text line, in a text tone. Decorative: the button carries the words. */
export function PixelIcon({
  name,
  tone = 'text',
  size = 1,
  outline = false,
}: {
  name: IconName;
  tone?: Tone;
  /** UI pixels per icon pixel, to sit on a line of PixelText at the same size. */
  size?: 1 | 2;
  /** A one-pixel dark outline, matching outlined PixelText (adds a pixel on every side). */
  outline?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pad = outline ? 1 : 0;
  const width = SIZE + 2 * pad;
  const height = LINE_HEIGHT + 2 * pad;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    const rows = ICONS[name];
    if (!ctx || !rows) return;
    ctx.clearRect(0, 0, width, height);
    const draw = (dx: number, dy: number, colour: string) => {
      ctx.fillStyle = colour;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] === 'x') ctx.fillRect(pad + dx + x, pad + dy + TOP + y, 1, 1);
        }
      });
    };
    if (pad) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) draw(dx, dy, css(ui.night));
    draw(0, 0, css(TONE_COLOUR[tone]));
  }, [name, tone, pad, width, height]);
  return (
    <span className="px-text">
      <canvas
        ref={ref}
        width={width}
        height={height}
        aria-hidden
        style={{
          width: `calc(var(--sf-px) * ${width * size})`,
          height: `calc(var(--sf-px) * ${height * size})`,
        }}
      />
    </span>
  );
}
