import { useEffect, useRef } from 'react';
import { css, logoRamp } from '../theme';
import { LOGO as rows, spriteColours } from '../theme/sprites';

const width = rows[0]?.length ?? 0;
const height = rows.length;

/** The small orange fish beside the app's name: one canvas pixel per UI pixel. */
export function Logo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const colours = spriteColours(logoRamp.body, logoRamp.fin);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const role = row[x] as keyof typeof colours | '.';
        if (role === '.') continue;
        ctx.fillStyle = css(colours[role]);
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
