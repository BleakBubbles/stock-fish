import { useEffect, useRef } from 'react';
import { css, logoColours } from '../theme';
import { LOGO as rows } from '../theme/sprites';

const width = rows[0]?.length ?? 0;
const height = rows.length;

/** The megalodon tooth beside the app's name: one canvas pixel per UI pixel. */
export function Logo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const hex = logoColours[row[x] ?? '.'];
        if (!hex) continue;
        ctx.fillStyle = css(hex);
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }, []);
  return (
    <canvas
      ref={ref}
      className="logo"
      width={width}
      height={height}
      aria-hidden="true"
      style={{
        width: `calc(var(--sf-px) * ${width})`,
        height: `calc(var(--sf-px) * ${height})`,
      }}
    />
  );
}
