import { Application, Assets, RenderTexture, Sprite, type Texture } from 'pixi.js';
// Shader setup without eval(), so the site's Content Security Policy can forbid it
// (public/_headers). Despite the name, this is the module that avoids unsafe-eval.
import 'pixi.js/unsafe-eval';
import { type ReactNode, useEffect, useRef } from 'react';
import { atlasUrl } from '../theme/atlas';
import { decorUrl } from '../theme/decor';
import { Rescale } from '../ui/pixel/PixelRoot';
import { usePixelScale } from '../ui/pixel/context';
import type { Weather } from '../mood';
import { type Region, tankZoom } from './arrange';
import type { Rect } from './territory';
import { TANK_HEIGHT, TANK_PAD, TANK_WIDTH, tankSize } from './constants';
import { type SceneFish, type SceneLabels, TankScene } from './scene';

/** Where the tank's art pixels sit inside the tank slot, in UI pixels. */
export interface TankPlacement {
  left: number;
  top: number;
  /** Device pixels per art pixel. */
  scale: number;
  /** The tank's own size in art pixels (it grows to fill the slot). */
  artWidth: number;
  artHeight: number;
  /** The tank's size and the space it sits in (the slot), in UI pixels. */
  width: number;
  height: number;
  slotWidth: number;
  slotHeight: number;
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
  /** How many fish are shown: with only a few, the tank zooms in. */
  fishCount: number;
  /** Which pens are shown: when it changes, fish no longer shown vanish instead of swimming off. */
  view: string;
  /** Picks the tank's sand, plants and rocks: the same seed always looks the same. */
  decorSeed: string;
  /** Tickers, changes and mood badges drawn with the fish. */
  labels: SceneLabels;
  regions: readonly Region[];
  /** Market closed: the tank light is off. */
  night: boolean;
  /** Portfolio weather shown in the water (calm draws nothing). */
  weather: Weather;
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
/**
 * With the system's "reduce motion" setting, the tank runs at this fraction of
 * normal speed: fish swim, pause and regroup slowly, but still visibly.
 */
const REDUCED_MOTION_SPEED = 0.3;

/** Art pixels a press must move before it becomes a drag. */
const DRAG_START = 3;

const penUnder = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-pen-id]')?.dataset.penId;

/**
 * The pixel pipeline: the scene is drawn at its native size into a render
 * texture with nearest-neighbour filtering, then shown upscaled by a whole
 * number. The scale is the app's tank scale (chosen so a 320 × 180 tank fits);
 * the native size then grows to fill the slot in whole art pixels (tankSize).
 * The canvas lives in a device-pixel layer (Rescale), so every art pixel is
 * exactly `scale` screen pixels at any devicePixelRatio.
 */
export function Tank({
  fish,
  active,
  groupOutline,
  fishCount,
  view,
  decorSeed,
  labels,
  regions,
  night,
  weather,
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
  const decorSeedRef = useRef(decorSeed);
  const labelsRef = useRef(labels);
  const appRef = useRef<Application>(undefined);
  // The newest props, for the async setup and event handlers below.
  const latest = useRef({
    fish,
    active,
    groupOutline,
    fishCount,
    regions,
    night,
    weather,
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
      fishCount,
      regions,
      night,
      weather,
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
      const [atlas, decor] = await Promise.all([
        Assets.load<Texture>(atlasUrl),
        Assets.load<Texture>(decorUrl),
      ]);
      if (disposed) {
        app.destroy(true);
        return;
      }
      atlas.source.scaleMode = 'nearest';
      decor.source.scaleMode = 'nearest';

      const scene = new TankScene(atlas, decor);
      sceneRef.current = scene;
      scene.setDecor(decorSeedRef.current);
      scene.setLabels(labelsRef.current);
      scene.setRegions(latest.current.regions);
      scene.setFish(latest.current.fish);
      scene.setNight(latest.current.night);
      scene.setWeather(latest.current.weather);
      scene.setSelected(latest.current.selectedId);
      scene.setGroupOutline(latest.current.groupOutline);

      const makeTarget = (width: number, height: number) =>
        RenderTexture.create({ width, height, resolution: 1, scaleMode: 'nearest' });
      let target = makeTarget(TANK_WIDTH, TANK_HEIGHT);
      const display = new Sprite(target);
      // Fish labels go over the upscaled tank, in label pixels (scaled below), so
      // they can be drawn bigger than the tank's art pixels (phones).
      app.stage.addChild(display, scene.overlay);
      /** The tank's current native size, art pixels. */
      const size = { w: TANK_WIDTH, h: TANK_HEIGHT };

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
        // A little room all round, then the app-wide tank scale (stepping down
        // if this host is small), zoomed in when there are only a few fish, and
        // the tank grown to fill the rest at that scale.
        const pad = TANK_PAD * ui;
        const roomW = hostW - 2 * pad;
        const roomH = hostH - 2 * pad;
        const base = tankSize(roomW, roomH, tank).scale;
        const { scale, width, height } = tankZoom(roomW, roomH, tank, latest.current.fishCount);
        if (width !== size.w || height !== size.h) {
          size.w = width;
          size.h = height;
          // A fresh texture at the new size (the sprite showing it takes its size from it).
          const old = target;
          target = makeTarget(width, height);
          display.texture = target;
          old.destroy(true);
          scene.setSize(width, height);
        }
        // Labels (text and mood badges) grow with the fish when zoomed in, but are
        // never smaller than the app's text: a label pixel is the larger of an art
        // pixel and a UI pixel, both whole device pixels. Fish swim as slowly in
        // art pixels as the tank is zoomed in, so they cross it in the same time.
        const labelPx = Math.max(scale, ui);
        scene.setZoom({ labels: scale / labelPx, pace: base / scale });
        scene.overlay.scale.set(labelPx);
        app.renderer.resize(width * scale, height * scale);
        canvas.style.width = `${width * scale}px`;
        canvas.style.height = `${height * scale}px`;
        // Centre on whole UI pixels, so labels drawn over the tank share its grid.
        const left = Math.max(0, Math.floor((hostW - width * scale) / 2 / ui));
        const top = Math.max(0, Math.floor((hostH - height * scale) / 2 / ui));
        canvas.style.marginLeft = `${left * ui}px`;
        canvas.style.marginTop = `${top * ui}px`;
        display.scale.set(scale);
        latest.current.onPlacement({
          left,
          top,
          scale,
          artWidth: width,
          artHeight: height,
          width: Math.ceil((width * scale) / ui),
          height: Math.ceil((height * scale) / ui),
          slotWidth: Math.floor(hostW / ui),
          slotHeight: Math.floor(hostH / ui),
        });
      };
      fitRef.current = fit;
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(host);

      appRef.current = app;
      if (!latest.current.active) app.ticker.stop();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      app.ticker.add((ticker) => {
        const speed = reduced.matches ? REDUCED_MOTION_SPEED : 1;
        scene.update(Math.min(ticker.deltaMS / 1000, MAX_DT) * speed);
        app.renderer.render({ container: scene.root, target, clear: true });
      });

      // Pointer position → art pixel (fractional).
      const toArt = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * size.w,
          y: ((e.clientY - rect.top) / rect.height) * size.h,
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
              : region && x >= 0 && x < size.w && y >= 0 && y < size.h
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

  useEffect(() => fitRef.current?.(), [pixelScale, fishCount]);
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
  useEffect(() => sceneRef.current?.setWeather(weather), [weather]);
  useEffect(() => {
    labelsRef.current = labels;
    sceneRef.current?.setLabels(labels);
  }, [labels]);
  useEffect(() => {
    decorSeedRef.current = decorSeed;
    sceneRef.current?.setDecor(decorSeed);
  }, [decorSeed]);
  useEffect(() => sceneRef.current?.setSelected(selectedId), [selectedId]);
  useEffect(() => sceneRef.current?.setGroupOutline(groupOutline), [groupOutline]);

  return (
    <div className="tank-slot" aria-label={label} role="region">
      <Rescale>
        <div ref={hostRef} className="tank-host" />
      </Rescale>
      {children}
    </div>
  );
}
