import { useEffect, useRef } from 'react';
import type { Mood } from '../mood/types';
import { css, type Hex } from '../theme';
import { type Body, SPRITE_HEIGHT, SPRITE_WIDTH, getSprite, spriteColours } from '../theme/sprites';

interface Props {
  body: Body;
  mood: Mood;
  primary: Hex;
  secondary: Hex;
  /** Whole-number multiple of the UI's art-pixel size. */
  scale?: number;
  label?: string;
}

/**
 * One fish drawn at native size into a 32 × 25 canvas, then enlarged by CSS
 * with nearest-neighbour filtering at a whole-number scale.
 */
export function FishSprite({ body, mood, primary, secondary, scale = 2, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const colours = spriteColours(primary, secondary);
    ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
    getSprite(body, mood).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const role = row[x] as keyof typeof colours | '.';
        if (role === '.') continue;
        ctx.fillStyle = css(colours[role]);
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }, [body, mood, primary, secondary]);

  return (
    <canvas
      ref={ref}
      className="fish-sprite"
      width={SPRITE_WIDTH}
      height={SPRITE_HEIGHT}
      style={{ '--fish-scale': Math.max(1, Math.round(scale)) } as React.CSSProperties}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
