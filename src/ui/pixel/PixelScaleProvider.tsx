import { type ReactNode, useEffect, useState } from 'react';
import { PixelScaleContext, readPixelGrid } from './context';
import type { PixelGrid } from './scale';

const same = (a: PixelGrid, b: PixelGrid) =>
  a.dpr === b.dpr && a.tank === b.tank && a.ui === b.ui && a.cols === b.cols && a.rows === b.rows;

/**
 * Tracks the pixel grid as the window resizes, zooms or moves to a screen with
 * a different devicePixelRatio.
 */
export function PixelScaleProvider({ children }: { children: ReactNode }) {
  const [grid, setGrid] = useState(readPixelGrid);

  useEffect(() => {
    const update = () =>
      setGrid((prev) => {
        const next = readPixelGrid();
        return same(prev, next) ? prev : next;
      });
    window.addEventListener('resize', update);
    // devicePixelRatio changes (browser zoom, moving between screens) don't
    // always fire resize; watch the current ratio and re-arm on each change.
    let query: MediaQueryList | undefined;
    const watchDpr = () => {
      query?.removeEventListener('change', onDpr);
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener('change', onDpr);
    };
    const onDpr = () => {
      update();
      watchDpr();
    };
    watchDpr();
    return () => {
      window.removeEventListener('resize', update);
      query?.removeEventListener('change', onDpr);
    };
  }, []);

  return <PixelScaleContext.Provider value={grid}>{children}</PixelScaleContext.Provider>;
}
