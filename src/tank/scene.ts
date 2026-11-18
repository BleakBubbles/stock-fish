/**
 * The tank scene in art pixels (320 × 180). Framework-free: Tank.tsx owns the
 * PixiJS application and renders this scene into a low-res render texture,
 * which is then upscaled by a whole number (CLAUDE.md, firm rule 4).
 */
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Mood } from '../mood/types';
import { css, ui } from '../theme';
import { atlasFrames, frameRect } from '../theme/atlas';
import type { AtlasLayer, TailPose } from '../theme/grid';
import type { Body, Face } from '../theme/sprites';
import {
  NIGHT_ALPHA,
  TANK_HEIGHT,
  TANK_MARGIN_BOTTOM,
  TANK_MARGIN_TOP,
  TANK_WIDTH,
  TAP_SLOP,
} from './constants';
import { type Region, boundsFor } from './arrange';
import { STILL_TAIL, type TailMotion, type TailState, stepTail, tailPose } from './tail';
import type { Rect } from './territory';
import {
  type Bounds,
  type Rand,
  type SwimState,
  hasLeft,
  leave,
  regroup,
  resume,
  spawn,
  step,
} from './swim';

export interface SceneFish {
  id: string;
  body: Body;
  mood: Mood;
  primary: string;
  secondary: string;
}

interface FishNode {
  spec: SceneFish;
  swim: SwimState;
  container: Container;
  layers: Record<AtlasLayer, Sprite>;
  tail: TailState;
  /** The frame on screen ("face/tail"), to skip texture swaps that change nothing. */
  shown: string;
}

/** Asleep, fish rest in the lowest few art pixels of their patch... */
const REST_BAND = 10;
/** ...and drift there, and about, at this fraction of their usual speed. */
const SLEEP_SPEED = 0.2;

/** A rising Z over a sleeping fish (art pixels; age in seconds). */
interface Zed {
  x: number;
  y: number;
  age: number;
}
/** How often a sleeping fish breathes out a Z (per second), and how many show at once. */
const ZED_RATE = 1 / 14;
const ZED_MAX = 3;
const ZED_LIFE = 2.4;
/** Art pixels a Z rises per second. */
const ZED_RISE = 4;
/** A 4 × 4 "Z", drawn in pixels. */
const ZED_PIXELS = ['####', '..#.', '.#..', '####'];

const FISH_W = atlasFrames.frameWidth;
const FISH_H = atlasFrames.frameHeight;

/** The whole water, for fish without a region (and for leaving). */
export const TANK_BOUNDS: Bounds = {
  minX: 0,
  minY: TANK_MARGIN_TOP,
  maxX: TANK_WIDTH - FISH_W,
  maxY: TANK_HEIGHT - FISH_H - TANK_MARGIN_BOTTOM,
};

export class TankScene {
  /** Everything drawn in the tank, in art pixels. Render this into the low-res texture. */
  readonly root = new Container();
  private readonly fishLayer = new Container();
  private readonly night = new Graphics();
  private readonly fish = new Map<string, FishNode>();
  private readonly frames = new Map<string, Texture>();
  private selected?: string;
  private hovered?: string;
  private regions: Region[] = [];
  private regionOf = new Map<string, Region>();
  private readonly patchOutline = new Graphics();
  private drag?: { id: string; dx: number; dy: number };
  /** Market closed: fish sleep (except the selected one, which wakes up). */
  private asleep = false;
  private zeds: Zed[] = [];
  private readonly zedLayer = new Graphics();
  private groupOutline?: Rect;
  /**
   * Where fish were when their pen was hidden, so they come back to the same
   * spot. Kept for the visit only; a sold fish's entry just goes unused.
   */
  private readonly parked = new Map<string, SwimState>();

  constructor(
    private readonly atlas: Texture,
    private readonly rand: Rand = Math.random,
  ) {
    const water = new Graphics().rect(0, 0, TANK_WIDTH, TANK_HEIGHT).fill(css(ui.water));
    this.night
      .rect(0, 0, TANK_WIDTH, TANK_HEIGHT)
      .fill({ color: css(ui.night), alpha: NIGHT_ALPHA });
    this.night.visible = false;
    // Z's float above the dimmed tank, so they're readable at night.
    this.root.addChild(water, this.patchOutline, this.fishLayer, this.night, this.zedLayer);
  }

  private frame(body: Body, face: Face, layer: AtlasLayer, tail: TailPose = 'mid'): Texture {
    const key = `${body}/${face}/${tail}/${layer}`;
    let texture = this.frames.get(key);
    if (!texture) {
      const r = frameRect(body, face, layer, tail);
      texture = new Texture({
        source: this.atlas.source,
        frame: new Rectangle(r.x, r.y, r.width, r.height),
      });
      this.frames.set(key, texture);
    }
    return texture;
  }

  /**
   * Add, update and remove fish to match `list`. Removed fish swim away first,
   * unless `instant` (the user switched to another view of the pens).
   */
  setFish(list: readonly SceneFish[], instant = false): void {
    const wanted = new Set(list.map((f) => f.id));
    for (const [id, node] of this.fish) {
      if (wanted.has(id)) continue;
      if (instant) {
        if (!node.swim.leaving) this.parked.set(id, node.swim);
        node.container.destroy({ children: true });
        this.fish.delete(id);
      } else if (!node.swim.leaving) {
        node.swim = leave(node.swim, TANK_BOUNDS, FISH_W);
      }
    }
    for (const spec of list) {
      const node = this.fish.get(spec.id);
      if (!node) this.addFish(spec);
      else this.applySpec(node, spec);
    }
    this.refreshHighlights();
  }

  private addFish(spec: SceneFish): void {
    const container = new Container();
    const layers = {} as Record<AtlasLayer, Sprite>;
    // Highlight first so it sits behind; it's a ring outside the silhouette anyway.
    for (const layer of ['highlight', 'body', 'fin', 'fixed'] as const) {
      const sprite = new Sprite(this.frame(spec.body, spec.mood, layer));
      layers[layer] = sprite;
      container.addChild(sprite);
    }
    layers.highlight.tint = css(ui.selectionOutline);
    layers.highlight.visible = false;
    const parked = this.parked.get(spec.id);
    this.parked.delete(spec.id);
    const node: FishNode = {
      spec,
      tail: STILL_TAIL,
      shown: '',
      swim: parked
        ? resume(parked, this.boundsOf(spec.id), this.rand)
        : spawn(this.rand, this.boundsOf(spec.id)),
      container,
      layers,
    };
    this.applySpec(node, spec, true);
    this.fish.set(spec.id, node);
    this.fishLayer.addChild(container);
    this.place(node);
  }

  private applySpec(node: FishNode, spec: SceneFish, force = false): void {
    const old = node.spec;
    node.spec = spec;
    if (force || old.body !== spec.body || old.mood !== spec.mood) node.shown = '';
    this.showFrame(node);
    node.layers.body.tint = css(spec.primary);
    node.layers.fin.tint = css(spec.secondary);
    node.spec = spec;
    if (node.swim.leaving && !force) {
      // Re-added before it finished leaving (e.g. an undo): come back.
      node.swim = regroup({ ...node.swim, leaving: false }, this.boundsOf(spec.id), this.rand);
    }
  }

  /**
   * Where each fish may swim. Fish outside their new region swim there
   * (quickly); the rest carry on.
   */
  setRegions(regions: readonly Region[]): void {
    this.regions = [...regions];
    this.regionOf = new Map(regions.flatMap((r) => r.fishIds.map((id) => [id, r] as const)));
    for (const [id, node] of this.fish) {
      if (id !== this.drag?.id) node.swim = regroup(node.swim, this.boundsOf(id), this.rand);
    }
    this.drawPatch();
  }

  private boundsOf(id: string): Bounds {
    const region = this.regionOf.get(id);
    const b = region ? boundsFor(region.rect) : TANK_BOUNDS;
    // Sleeping fish rest low in their patch.
    return this.asleep && id !== this.selected
      ? { ...b, minY: Math.max(b.minY, b.maxY - REST_BAND) }
      : b;
  }

  /** Outline the selected fish's territory (1 art pixel, inside its edges). */
  /** Outline a whole group's area (a selected group label), instead of a fish's patch. */
  setGroupOutline(rect: Rect | undefined): void {
    this.groupOutline = rect;
    this.drawPatch();
  }

  private drawPatch(): void {
    const g = this.patchOutline.clear();
    const region = this.selected ? this.regionOf.get(this.selected) : undefined;
    const rect =
      this.groupOutline ?? (region?.patch && this.regions.length >= 2 ? region.rect : undefined);
    if (!rect) return;
    const { x, y, w, h } = rect;
    const colour = css(ui.territory);
    g.rect(x, y, w, 1)
      .rect(x, y + h - 1, w, 1)
      .rect(x, y, 1, h)
      .rect(x + w - 1, y, 1, h)
      .fill(colour);
  }

  /** The region under an art-pixel point. */
  regionAt(x: number, y: number): Region | undefined {
    return this.regions.find(
      ({ rect: r }) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h,
    );
  }

  /** Pick a fish up; (x, y) is the art pixel under the pointer. */
  startDrag(id: string, x: number, y: number): void {
    const node = this.fish.get(id);
    if (!node || node.swim.leaving) return;
    this.drag = { id, dx: x - node.swim.x, dy: y - node.swim.y };
    this.fishLayer.setChildIndex(node.container, this.fishLayer.children.length - 1);
  }

  dragTo(x: number, y: number): void {
    const node = this.drag ? this.fish.get(this.drag.id) : undefined;
    if (!node || !this.drag) return;
    const nx = Math.min(TANK_BOUNDS.maxX, Math.max(TANK_BOUNDS.minX, x - this.drag.dx));
    const ny = Math.min(TANK_BOUNDS.maxY, Math.max(TANK_BOUNDS.minY, y - this.drag.dy));
    if (Math.abs(nx - node.swim.x) >= 1) node.swim.facing = nx > node.swim.x ? 1 : -1;
    node.swim = { ...node.swim, x: nx, y: ny, targetX: nx, targetY: ny, pause: 0.3 };
    this.place(node);
  }

  /** Let go: the fish swims into whatever region it now belongs to. */
  endDrag(): void {
    const id = this.drag?.id;
    this.drag = undefined;
    const node = id ? this.fish.get(id) : undefined;
    if (id && node) node.swim = regroup(node.swim, this.boundsOf(id), this.rand);
    this.refreshHighlights();
  }

  /** The face a fish shows now: asleep at night, unless it's the one tapped awake. */
  private faceOf(id: string, node: FishNode): Face {
    return this.asleep && id !== this.selected && id !== this.drag?.id
      ? 'sleeping'
      : node.spec.mood;
  }

  /** Set the textures for the fish's current face and tail pose (if they changed). */
  private showFrame(node: FishNode, id = node.spec.id): void {
    const face = this.faceOf(id, node);
    const tail = tailPose(node.tail);
    const key = `${face}/${tail}`;
    if (key === node.shown) return;
    node.shown = key;
    for (const layer of Object.keys(node.layers) as AtlasLayer[]) {
      node.layers[layer].texture = this.frame(node.spec.body, face, layer, tail);
    }
  }

  setNight(on: boolean): void {
    this.night.visible = on;
    if (on === this.asleep) return;
    this.asleep = on;
    // Settle down to rest at the bottom of each patch (or wake and spread out).
    for (const [id, node] of this.fish) {
      if (id !== this.drag?.id) node.swim = regroup(node.swim, this.boundsOf(id), this.rand);
      this.showFrame(node, id);
    }
    if (!on) this.zeds = [];
  }

  setSelected(id: string | undefined): void {
    const before = this.selected;
    this.selected = id;
    // Tapping a sleeping fish wakes it (its mood face shows); the last one dozes off.
    for (const fid of [before, id]) {
      const node = fid ? this.fish.get(fid) : undefined;
      if (fid && node) {
        this.showFrame(node, fid);
        node.swim = regroup(node.swim, this.boundsOf(fid), this.rand);
      }
    }
    this.refreshHighlights();
    this.drawPatch();
  }

  setHovered(id: string | undefined): void {
    this.hovered = id;
    this.refreshHighlights();
  }

  private refreshHighlights(): void {
    for (const [id, node] of this.fish) {
      node.layers.highlight.visible =
        id === this.selected || id === this.hovered || id === this.drag?.id;
    }
    // Draw the selected fish on top so its outline is never hidden.
    const topId = this.drag?.id ?? this.selected;
    const top = topId ? this.fish.get(topId) : undefined;
    if (top) this.fishLayer.setChildIndex(top.container, this.fishLayer.children.length - 1);
  }

  /** Advance every fish by `dt` seconds. */
  update(dt: number): void {
    for (const [id, node] of this.fish) {
      const sleeping = this.faceOf(id, node) === 'sleeping';
      node.tail = stepTail(
        node.tail,
        dt,
        this.motionOf(id, node, sleeping),
        node.swim.speed,
        this.rand,
      );
      this.showFrame(node, id);
      if (id === this.drag?.id) continue;
      // Asleep, everything happens slowly: drifting down, and drifting about.
      node.swim = step(node.swim, sleeping ? dt * SLEEP_SPEED : dt, this.rand, this.boundsOf(id));
      if (sleeping && !node.swim.leaving && this.rand() < dt * ZED_RATE) this.breathe(node);
      if (hasLeft(node.swim, TANK_BOUNDS, FISH_W)) {
        node.container.destroy({ children: true });
        this.fish.delete(id);
        continue;
      }
      this.place(node);
    }
    this.updateZeds(dt);
  }

  /** What the tail should be doing, from what the fish is doing. */
  private motionOf(id: string, node: FishNode, sleeping: boolean): TailMotion {
    if (id === this.drag?.id) return 'held';
    if (sleeping) return 'asleep';
    if (node.swim.pause > 0) return 'rest';
    return node.swim.hurry || node.swim.leaving ? 'hurry' : 'swim';
  }

  /** A Z rises from a sleeping fish's head (the nose end, wherever it faces). */
  private breathe(node: FishNode): void {
    if (this.zeds.length >= ZED_MAX) return;
    const x = Math.round(node.swim.x);
    const head = node.swim.facing === 1 ? x + FISH_W - 9 : x + 5;
    this.zeds.push({ x: head, y: Math.round(node.swim.y) + 2, age: 0 });
  }

  /** Age, move and draw the Z's: whole art pixels, the muted text colour. */
  private updateZeds(dt: number): void {
    this.zeds = this.zeds.flatMap((z) =>
      z.age + dt < ZED_LIFE ? [{ ...z, age: z.age + dt }] : [],
    );
    const g = this.zedLayer.clear();
    for (const z of this.zeds) {
      const zx = z.x + Math.round(Math.sin(z.age * 2) * 1.5);
      const zy = z.y - Math.round(z.age * ZED_RISE) - ZED_PIXELS.length;
      ZED_PIXELS.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '#') g.rect(zx + x, zy + y, 1, 1);
      });
    }
    if (this.zeds.length) g.fill(css(ui.textMuted));
  }

  /** Snap to whole art pixels; mirror (never rotate) to face left. */
  private place(node: FishNode): void {
    const x = Math.round(node.swim.x);
    const y = Math.round(node.swim.y);
    const left = node.swim.facing === -1;
    node.container.scale.x = left ? -1 : 1;
    node.container.position.set(left ? x + FISH_W : x, y);
  }

  /** Topmost fish under an art-pixel point (bounding box plus a little slop), if any. */
  fishAt(x: number, y: number): string | undefined {
    const children = this.fishLayer.children;
    for (let i = children.length - 1; i >= 0; i--) {
      for (const [id, node] of this.fish) {
        if (node.container !== children[i] || node.swim.leaving) continue;
        const fx = Math.round(node.swim.x);
        const fy = Math.round(node.swim.y);
        if (
          x >= fx - TAP_SLOP &&
          x < fx + FISH_W + TAP_SLOP &&
          y >= fy - TAP_SLOP &&
          y < fy + FISH_H + TAP_SLOP
        ) {
          return id;
        }
      }
    }
    return undefined;
  }

  destroy(): void {
    for (const texture of this.frames.values()) texture.destroy(false);
    this.root.destroy({ children: true });
  }
}
