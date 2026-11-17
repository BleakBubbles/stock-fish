import type { CSSProperties, ReactNode } from 'react';
import { usePixelScale } from './context';

/**
 * The pixel UI's coordinate space. Inside it 1 CSS px is 1 UI pixel
 * (--sf-px: 1px), so layout that sticks to whole numbers lands on whole
 * numbers exactly (browsers lay out in 1/64 px steps, which can't hold values
 * like 2.667). One transform then scales the whole block by ui ÷ dpr, which
 * maps every whole UI pixel onto exactly `ui` device pixels at any
 * devicePixelRatio or zoom level.
 */
export function PixelRoot({ className, children }: { className?: string; children: ReactNode }) {
  const { dpr, ui, cols, rows } = usePixelScale();
  const style: CSSProperties = {
    width: `${cols}px`,
    height: `${rows}px`,
    transform: `scale(${ui / dpr})`,
  };
  return (
    <div className={['px-root', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

/**
 * Fills its (positioned) parent with a layer in another unit, undoing the
 * pixel root's scale:
 * - `device`: 1 CSS px = 1 device pixel (the tank's canvas).
 * - `css`: 1 CSS px = 1 normal CSS px, for screens not converted to pixel UI
 *   yet; --sf-px is the UI pixel in CSS px there, as before, and isn't exact.
 */
export function Rescale({
  unit,
  className,
  children,
}: {
  unit: 'device' | 'css';
  className?: string;
  children: ReactNode;
}) {
  const { dpr, ui } = usePixelScale();
  // Local units per UI pixel.
  const f = unit === 'device' ? ui : ui / dpr;
  const style = {
    width: `${100 * f}%`,
    height: `${100 * f}%`,
    transform: `scale(${1 / f})`,
    '--sf-px': `${f}px`,
  } as CSSProperties;
  return (
    <div className={['px-rescale', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}
