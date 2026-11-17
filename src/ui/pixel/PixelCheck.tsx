import { useEffect, useState } from 'react';
import { usePixelScale } from './context';

/** Elements that must sit on whole device pixels. */
const SELECTOR = '.px-text canvas, .px-button, .px-panel, .px-bar, .tank-canvas';

/**
 * Debug overlay, shown when the URL contains ?pixels: reports the pixel grid
 * and how many pixel-UI elements have an edge off a whole device pixel
 * (ignoring edges at or past the window's edges). For checking real devices.
 */
export function PixelCheck() {
  const scale = usePixelScale();
  const [report, setReport] = useState('');

  useEffect(() => {
    const check = () => {
      const dpr = scale.dpr;
      const maxX = window.innerWidth * dpr;
      const maxY = window.innerHeight * dpr;
      let off = 0;
      let worst = 0;
      const nodes = document.querySelectorAll<HTMLElement>(SELECTOR);
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        const edges: [number, number][] = [
          [r.left * dpr, maxX],
          [r.top * dpr, maxY],
          [r.right * dpr, maxX],
          [r.bottom * dpr, maxY],
        ];
        for (const [v, max] of edges) {
          if (v >= max - 0.5) continue; // at or past the window's edge: off screen
          const err = Math.abs(v - Math.round(v));
          worst = Math.max(worst, err);
          if (err > 0.01) {
            off++;
            break;
          }
        }
      }
      setReport(
        `dpr ${dpr} · tank ${scale.tank} · ui ${scale.ui} device px · ` +
          `${nodes.length - off}/${nodes.length} on grid · worst ${worst.toFixed(3)} px`,
      );
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [scale]);

  return <output className="pixel-check">{report}</output>;
}
