import type { CSSProperties } from 'react';
import { rangeBarLayout } from './rangeBarLayout';

/** Rows of the bar, top to bottom (UI pixels). */
const HEIGHT = 7;
const TRACK_Y = 3;
const BAND = { y: 2, h: 3 };
const TICK = { y: 1, h: 5 };

const px = (n: number) => `calc(var(--sf-px) * ${n})`;
const rect = (x: number, y: number, w: number, h: number, colour: string): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  width: px(w),
  height: px(h),
  background: `var(--sf-${colour})`,
});

/**
 * Where today's move falls against a typical day: a calm band in the middle,
 * ticks where strong moves begin, and a marker for today. A picture of the
 * mood's reasoning; the numbers stay in text beside it, so it is hidden from
 * screen readers.
 */
export function RangeBar({ z, width }: { z: number; width: number }) {
  const l = rangeBarLayout(z, width);
  return (
    <div
      className="range-bar"
      aria-hidden="true"
      style={{ position: 'relative', width: px(l.width), height: px(HEIGHT) }}
    >
      <div style={rect(0, TRACK_Y, l.width, 1, 'buttonShadow')} />
      <div style={rect(l.band.x, BAND.y, l.band.w, BAND.h, 'buttonShadow')} />
      {l.ticks.map((x) => (
        <div key={x} style={rect(x, TICK.y, 1, TICK.h, 'buttonShadow')} />
      ))}
      <div
        style={{
          ...rect(l.marker - 1, 0, 3, HEIGHT, 'text'),
          boxShadow: `0 0 0 var(--sf-px) var(--sf-border)`,
        }}
      />
      {l.beyond !== 0 && (
        <div style={rect(l.beyond > 0 ? l.marker - 3 : l.marker + 3, TRACK_Y - 1, 1, 3, 'text')} />
      )}
    </div>
  );
}
