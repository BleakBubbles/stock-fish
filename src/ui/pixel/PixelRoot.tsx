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
 * Fills its (positioned) parent with a layer in device pixels (1 CSS px = 1
 * device pixel), undoing the pixel root's scale: for the tank's canvas, whose
 * art pixels are whole device pixels rather than whole UI pixels.
 */
export function Rescale({ className, children }: { className?: string; children: ReactNode }) {
  const { ui } = usePixelScale();
  const style = {
    width: `${100 * ui}%`,
    height: `${100 * ui}%`,
    transform: `scale(${1 / ui})`,
    '--sf-px': `${ui}px`,
  } as CSSProperties;
  return (
    <div className={['px-rescale', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}
