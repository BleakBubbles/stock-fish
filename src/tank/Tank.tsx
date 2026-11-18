import { Application, Assets, RenderTexture, Sprite, type Texture } from 'pixi.js';
import { type ReactNode, useEffect, useRef } from 'react';
import { atlasUrl } from '../theme/atlas';
import { Rescale } from '../ui/pixel/PixelRoot';
import { usePixelScale } from '../ui/pixel/context';
import type { Region } from './arrange';
import type { Rect } from './territory';
import { TANK_HEIGHT, TANK_WIDTH, integerScale } from './constants';
import { type SceneFish, TankScene } from './scene';

/** Where the tank's art pixels sit inside the tank slot, in UI pixels. */
export interface TankPlacement {
  left: number;
  top: number;
  /** Device pixels per art pixel. */
  scale: number;
}

/** Where a dragged fish was let go. */
export type DropTarget =
  | { kind: 'region'; region: Region }
  /** An element marked with data-pen-id (a pen tab). */
  | { kind: 'pen'; penId: string };

interface Props {
  fish: readonly SceneFish[];
  /** False while hidden: animation stops (and resumes where it left off). */
  active: boolean;
  /** A selected group's whole area, outlined like a fish's territory. */
  groupOutline?: Rect;
  /** Which pens are shown: when it changes, fish no longer shown vanish instead of swimming off. */
  view: string;
  regions: readonly Region[];
  /** Market closed: the tank light is off. */
  night: boolean;
  selectedId?: string;
  /** A fish was tapped. */
  onSelect: (id: string) => void;
  /** Open water was tapped, at this art pixel. */
  onTapWater: (x: number, y: number) => void;
  /** A fish was dragged and dropped (on the tank or a pen tab). */
  onDrop: (id: string, target: DropTarget | undefined) => void;
  /** While dragging: the pen tab under the pointer, if any. */
  onDragOverPen: (penId: string | undefined) => void;
  onPlacement: (placement: TankPlacement) => void;
  label: string;
  /** Drawn over the tank (labels), in UI pixels. */
  children?: ReactNode;
}

/** Longest frame step we simulate, so a backgrounded tab doesn't teleport fish. */
const MAX_DT = 0.1;
/** Art pixels a press must move before it becomes a drag. */
const DRAG_START = 3;

const penUnder = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-pen-id]')?.dataset.penId;

/**
 * The pixel pipeline: the scene is drawn at native 320 × 180 into a render
 * texture with nearest-neighbour filtering, then shown upscaled by the largest
 * whole number that fits. The canvas lives in a device-pixel layer (Rescale),
 * so every art pixel is exactly `scale` screen pixels at any devicePixelRatio.
 */
export function Tank({
  fish,
  active,
  groupOutline,
  view,
  regions,
  night,
  selectedId,
  onSelect,
  onTapWater,
  onDrop,
  onDragOverPen,
  onPlacement,
  label,
  children,
}: Props) {
  const pixelScale = usePixelScale();
  const fitRef = useRef<() => void>(undefined);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TankScene>(undefined);
  const appRef = useRef<Application>(undefined);
  // The newest props, for the async setup and event handlers below.
  const latest = useRef({
    fish,
    active,
    groupOutline,
    regions,
    night,
    selectedId,
    onSelect,
    onTapWater,
    onDrop,
    onDragOverPen,
    onPlacement,
    pixelScale,
  });
  useEffect(() => {
    latest.current = {
      fish,
      active,
      groupOutline,
      regions,
      night,
      selectedId,
      onSelect,
      onTapWater,
      onDrop,
      onDragOverPen,
      onPlacement,
      pixelScale,
    };
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
      scene.setRegions(latest.current.regions);
      scene.setFish(latest.current.fish);
      scene.setNight(latest.current.night);
      scene.setSelected(latest.current.selectedId);
      scene.setGroupOutline(latest.current.groupOutline);

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
        // Hidden (another site tab): keep the last size rather than shrinking to nothing.
        if (host.clientWidth === 0 || host.clientHeight === 0) return;
        const { dpr, tank, ui } = latest.current.pixelScale;
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
        // Centre on whole UI pixels, so labels drawn over the tank share its grid.
        const left = Math.max(0, Math.floor((hostW - TANK_WIDTH * scale) / 2 / ui));
        const top = Math.max(0, Math.floor((hostH - TANK_HEIGHT * scale) / 2 / ui));
        canvas.style.marginLeft = `${left * ui}px`;
        canvas.style.marginTop = `${top * ui}px`;
        display.scale.set(scale);
        latest.current.onPlacement({ left, top, scale });
      };
      fitRef.current = fit;
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(host);

      appRef.current = app;
      if (!latest.current.active) app.ticker.stop();
      app.ticker.add((ticker) => {
        scene.update(Math.min(ticker.deltaMS / 1000, MAX_DT));
        app.renderer.render({ container: scene.root, target, clear: true });
      });

      // Pointer position → art pixel (fractional).
      const toArt = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * TANK_WIDTH,
          y: ((e.clientY - rect.top) / rect.height) * TANK_HEIGHT,
        };
      };

      // A press on a fish selects it on release, or becomes a drag once it moves.
      let press: { id?: string; x: number; y: number; pointer: number } | undefined;
      let dragging = false;
      let overPen: string | undefined;

      const setOverPen = (penId: string | undefined) => {
        if (penId === overPen) return;
        overPen = penId;
        latest.current.onDragOverPen(penId);
      };

      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const { x, y } = toArt(e);
        press = { id: scene.fishAt(Math.floor(x), Math.floor(y)), x, y, pointer: e.pointerId };
        dragging = false;
        canvas.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        const { x, y } = toArt(e);
        if (press && press.pointer === e.pointerId) {
          if (!dragging && press.id && Math.hypot(x - press.x, y - press.y) >= DRAG_START) {
            dragging = true;
            scene.setHovered(undefined);
            scene.startDrag(press.id, press.x, press.y);
            canvas.style.cursor = 'grabbing';
          }
          if (dragging) {
            scene.dragTo(x, y);
            setOverPen(penUnder(e.clientX, e.clientY));
          }
          return;
        }
        if (e.pointerType !== 'mouse') return;
        const id = scene.fishAt(Math.floor(x), Math.floor(y));
        scene.setHovered(id);
        canvas.style.cursor = id ? 'pointer' : 'default';
      };
      const onUp = (e: PointerEvent) => {
        if (!press || press.pointer !== e.pointerId) return;
        const { id } = press;
        press = undefined;
        if (dragging && id) {
          dragging = false;
          const { x, y } = toArt(e);
          const penId = penUnder(e.clientX, e.clientY);
          const region = scene.regionAt(Math.floor(x), Math.floor(y));
          setOverPen(undefined);
          scene.endDrag();
          canvas.style.cursor = 'default';
          latest.current.onDrop(
            id,
            penId
              ? { kind: 'pen', penId }
              : region && x >= 0 && x < TANK_WIDTH && y >= 0 && y < TANK_HEIGHT
                ? { kind: 'region', region }
                : undefined,
          );
          return;
        }
        if (id) {
          latest.current.onSelect(id);
        } else {
          const { x, y } = toArt(e);
          latest.current.onTapWater(Math.floor(x), Math.floor(y));
        }
      };
      const onCancel = () => {
        if (dragging) scene.endDrag();
        press = undefined;
        dragging = false;
        setOverPen(undefined);
      };
      const onLeave = () => scene.setHovered(undefined);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onCancel);
      canvas.addEventListener('pointerleave', onLeave);
      // After a finger tap, browsers send a late "click" to whatever is under
      // the finger by then: the panel the tap just opened, pressing one of its
      // buttons. Taps are fully handled by the pointer events above, so cancel
      // the touch's default actions (that click, and double-tap zoom).
      const onTouchEnd = (e: TouchEvent) => {
        if (e.cancelable) e.preventDefault();
      };
      canvas.addEventListener('touchend', onTouchEnd, { passive: false });

      cleanup = () => {
        observer.disconnect();
        fitRef.current = undefined;
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('touchend', onTouchEnd);
        scene.destroy();
        target.destroy(true);
        sceneRef.current = undefined;
        appRef.current = undefined;
        app.destroy(true);
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => fitRef.current?.(), [pixelScale]);
  useEffect(() => {
    const ticker = appRef.current?.ticker;
    if (!ticker) return;
    if (active) {
      fitRef.current?.(); // the window may have changed size while hidden
      ticker.start();
    } else {
      ticker.stop();
    }
  }, [active]);
  // Regions before fish, so new fish spawn inside their own territory.
  useEffect(() => sceneRef.current?.setRegions(regions), [regions]);
  const shownView = useRef(view);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setFish(fish, shownView.current !== view);
    shownView.current = view;
  }, [fish, view]);
  useEffect(() => sceneRef.current?.setNight(night), [night]);
  useEffect(() => sceneRef.current?.setSelected(selectedId), [selectedId]);
  useEffect(() => sceneRef.current?.setGroupOutline(groupOutline), [groupOutline]);

  return (
    <div className="tank-slot" aria-label={label} role="region">
      <Rescale unit="device">
        <div ref={hostRef} className="tank-host" />
      </Rescale>
      {children}
    </div>
  );
}
