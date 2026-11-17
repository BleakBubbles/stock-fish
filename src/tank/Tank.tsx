import { Application, Assets, RenderTexture, Sprite, type Texture } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { atlasUrl } from '../theme/atlas';
import { Rescale } from '../ui/pixel/PixelRoot';
import { usePixelScale } from '../ui/pixel/context';
import { TANK_HEIGHT, TANK_WIDTH, integerScale } from './constants';
import { type SceneFish, TankScene } from './scene';

interface Props {
  fish: readonly SceneFish[];
  /** Market closed: the tank light is off. */
  night: boolean;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  label: string;
}

/** Longest frame step we simulate, so a backgrounded tab doesn't teleport fish. */
const MAX_DT = 0.1;

/**
 * The pixel pipeline: the scene is drawn at native 320 × 180 into a render
 * texture with nearest-neighbour filtering, then shown upscaled by the largest
 * whole number that fits. The canvas lives in a device-pixel layer (Rescale),
 * so every art pixel is exactly `scale` screen pixels at any devicePixelRatio.
 */
export function Tank({ fish, night, selectedId, onSelect, label }: Props) {
  const pixelScale = usePixelScale();
  const fitRef = useRef<() => void>(undefined);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TankScene>(undefined);
  // The newest props, for the async setup and event handlers below.
  const latest = useRef({ fish, night, selectedId, onSelect, pixelScale });
  useEffect(() => {
    latest.current = { fish, night, selectedId, onSelect, pixelScale };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      await app.init({ width: TANK_WIDTH, height: TANK_HEIGHT, antialias: false, resolution: 1 });
      const atlas = await Assets.load<Texture>(atlasUrl);
      if (disposed) {
        app.destroy(true);
        return;
      }
      atlas.source.scaleMode = 'nearest';

      const scene = new TankScene(atlas);
      sceneRef.current = scene;
      scene.setFish(latest.current.fish);
      scene.setNight(latest.current.night);
      scene.setSelected(latest.current.selectedId);

      const target = RenderTexture.create({
        width: TANK_WIDTH,
        height: TANK_HEIGHT,
        resolution: 1,
        scaleMode: 'nearest',
      });
      const display = new Sprite(target);
      app.stage.addChild(display);

      const canvas = app.canvas;
      canvas.setAttribute('role', 'img');
      canvas.classList.add('tank-canvas');
      host.appendChild(canvas);

      const fit = () => {
        const { dpr, tank } = latest.current.pixelScale;
        // The host is in device pixels (Rescale). Only count the part on screen:
        // the pixel root can overhang the window by less than one UI pixel.
        const rect = host.getBoundingClientRect();
        const hostW = Math.min(host.clientWidth, Math.round((window.innerWidth - rect.left) * dpr));
        const hostH = Math.min(
          host.clientHeight,
          Math.round((window.innerHeight - rect.top) * dpr),
        );
        // The app-wide tank scale, unless this host is smaller than expected.
        const scale = Math.max(1, Math.min(tank, integerScale(hostW, hostH)));
        app.renderer.resize(TANK_WIDTH * scale, TANK_HEIGHT * scale);
        canvas.style.width = `${TANK_WIDTH * scale}px`;
        canvas.style.height = `${TANK_HEIGHT * scale}px`;
        // Centre on whole device pixels.
        canvas.style.marginLeft = `${Math.max(0, Math.floor((hostW - TANK_WIDTH * scale) / 2))}px`;
        canvas.style.marginTop = `${Math.max(0, Math.floor((hostH - TANK_HEIGHT * scale) / 2))}px`;
        display.scale.set(scale);
      };
      fitRef.current = fit;
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(host);

      app.ticker.add((ticker) => {
        scene.update(Math.min(ticker.deltaMS / 1000, MAX_DT));
        app.renderer.render({ container: scene.root, target, clear: true });
      });

      // Pointer position → art pixel.
      const toArt = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: Math.floor(((e.clientX - rect.left) / rect.width) * TANK_WIDTH),
          y: Math.floor(((e.clientY - rect.top) / rect.height) * TANK_HEIGHT),
        };
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        const { x, y } = toArt(e);
        const id = scene.fishAt(x, y);
        scene.setHovered(id);
        canvas.style.cursor = id ? 'pointer' : 'default';
      };
      const onLeave = () => scene.setHovered(undefined);
      const onDown = (e: PointerEvent) => {
        const { x, y } = toArt(e);
        latest.current.onSelect(scene.fishAt(x, y));
      };
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerdown', onDown);

      cleanup = () => {
        observer.disconnect();
        fitRef.current = undefined;
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown);
        scene.destroy();
        target.destroy(true);
        sceneRef.current = undefined;
        app.destroy(true);
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => fitRef.current?.(), [pixelScale]);
  useEffect(() => sceneRef.current?.setFish(fish), [fish]);
  useEffect(() => sceneRef.current?.setNight(night), [night]);
  useEffect(() => sceneRef.current?.setSelected(selectedId), [selectedId]);

  return (
    <div className="tank-slot" aria-label={label} role="region">
      <Rescale unit="device">
        <div ref={hostRef} className="tank-host" />
      </Rescale>
    </div>
  );
}
