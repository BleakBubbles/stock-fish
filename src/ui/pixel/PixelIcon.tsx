import { useLayoutEffect, useRef } from 'react';
import { css } from '../../theme';
import { ICONS } from '../../theme/sprites';
import { TONE_COLOUR, type Tone } from './tones';

/** The icons in art/ui/icons. */
export type IconName =
  | 'arrange'
  | 'back'
  | 'check'
  | 'close'
  | 'colours'
  | 'delete'
  | 'edit'
  | 'export'
  | 'forward'
  | 'holdings'
  | 'import'
  | 'plus'
  | 'settings'
  | 'show'
  | 'tank'
  | 'test';

const SIZE = 7;
/** The font's line is 9 pixels tall with capitals on rows 3 to 7: two rows down centres a 7-pixel icon on them. */
const LINE_HEIGHT = 9;
const TOP = 2;

/** A 7 × 7 pixel icon on a text line, in a text tone. Decorative: the button carries the words. */
export function PixelIcon({ name, tone = 'text' }: { name: IconName; tone?: Tone }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    const rows = ICONS[name];
    if (!ctx || !rows) return;
    ctx.clearRect(0, 0, SIZE, LINE_HEIGHT);
    ctx.fillStyle = css(TONE_COLOUR[tone]);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === 'x') ctx.fillRect(x, TOP + y, 1, 1);
    });
  }, [name, tone]);
  return (
    <span className="px-text">
      <canvas
        ref={ref}
        width={SIZE}
        height={LINE_HEIGHT}
        aria-hidden
        style={{
          width: `calc(var(--sf-px) * ${SIZE})`,
          height: `calc(var(--sf-px) * ${LINE_HEIGHT})`,
        }}
      />
    </span>
  );
}
