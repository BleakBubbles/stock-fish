import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { css, ui } from '../theme';
import { TANK_HEIGHT, TANK_WIDTH, integerScale } from './constants';

/**
 * Milestone 1 placeholder: an empty tank at integer scale, proving the PixiJS
 * wiring. The real low-res render texture pipeline comes in milestone 4.
 */
export function Tank() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let disposed = false;
    let ready = false;

    const fit = () => {
      if (!ready) return;
      const scale = integerScale(host.clientWidth, host.clientHeight);
      app.renderer.resize(TANK_WIDTH * scale, TANK_HEIGHT * scale);
    };
    const observer = new ResizeObserver(fit);

    void app
      .init({
        width: TANK_WIDTH,
        height: TANK_HEIGHT,
        background: css(ui.water),
        antialias: false,
        resolution: 1,
      })
      .then(() => {
        if (disposed) {
          app.destroy(true);
          return;
        }
        ready = true;
        app.canvas.setAttribute('aria-label', 'Fish tank');
        host.appendChild(app.canvas);
        fit();
        observer.observe(host);
      });

    return () => {
      disposed = true;
      observer.disconnect();
      if (ready) app.destroy(true);
    };
  }, []);

  return <div ref={hostRef} className="tank-host" />;
}
