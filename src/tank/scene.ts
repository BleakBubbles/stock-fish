/**
 * The tank scene in art pixels (320 × 180). Framework-free: Tank.tsx owns the
 * PixiJS application and renders this scene into a low-res render texture,
 * which is then upscaled by a whole number (CLAUDE.md, firm rule 4).
 */
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Mood } from '../mood/types';
import { css, ui } from '../theme';
import { atlasFrames, frameRect } from '../theme/atlas';
import type { AtlasLayer } from '../theme/grid';
import type { Body } from '../theme/sprites';
import {
  NIGHT_ALPHA,
  TANK_HEIGHT,
  TANK_MARGIN_BOTTOM,
  TANK_MARGIN_TOP,
  TANK_WIDTH,
  TAP_SLOP,
} from './constants';
import {
  type Bounds,
  type Rand,
  type SwimState,
  clampTo,
  hasLeft,
  leave,
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
}

const FISH_W = atlasFrames.frameWidth;
const FISH_H = atlasFrames.frameHeight;

/** The whole tank is open water for now; pens and territories arrive in milestone 5. */
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

  constructor(
    private readonly atlas: Texture,
    private readonly rand: Rand = Math.random,
  ) {
    const water = new Graphics().rect(0, 0, TANK_WIDTH, TANK_HEIGHT).fill(css(ui.water));
    this.night
      .rect(0, 0, TANK_WIDTH, TANK_HEIGHT)
      .fill({ color: css(ui.night), alpha: NIGHT_ALPHA });
    this.night.visible = false;
    this.root.addChild(water, this.fishLayer, this.night);
  }

  private frame(body: Body, mood: Mood, layer: AtlasLayer): Texture {
    const key = `${body}/${mood}/${layer}`;
    let texture = this.frames.get(key);
    if (!texture) {
      const r = frameRect(body, mood, layer);
      texture = new Texture({
        source: this.atlas.source,
        frame: new Rectangle(r.x, r.y, r.width, r.height),
      });
      this.frames.set(key, texture);
    }
    return texture;
  }

  /** Add, update and remove fish to match `list`. Removed fish swim away first. */
  setFish(list: readonly SceneFish[]): void {
    const wanted = new Set(list.map((f) => f.id));
    for (const [id, node] of this.fish) {
      if (!wanted.has(id) && !node.swim.leaving) node.swim = leave(node.swim, TANK_BOUNDS, FISH_W);
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
    const node: FishNode = { spec, swim: spawn(this.rand, TANK_BOUNDS), container, layers };
    this.applySpec(node, spec, true);
    this.fish.set(spec.id, node);
    this.fishLayer.addChild(container);
    this.place(node);
  }

  private applySpec(node: FishNode, spec: SceneFish, force = false): void {
    const old = node.spec;
    if (force || old.body !== spec.body || old.mood !== spec.mood) {
      for (const layer of Object.keys(node.layers) as AtlasLayer[]) {
        node.layers[layer].texture = this.frame(spec.body, spec.mood, layer);
      }
    }
    node.layers.body.tint = css(spec.primary);
    node.layers.fin.tint = css(spec.secondary);
    node.spec = spec;
    if (node.swim.leaving && !force) {
      // Re-added before it finished leaving (e.g. an undo): come back.
      node.swim = clampTo({ ...node.swim, leaving: false }, TANK_BOUNDS);
    }
  }

  setNight(on: boolean): void {
    this.night.visible = on;
  }

  setSelected(id: string | undefined): void {
    this.selected = id;
    this.refreshHighlights();
  }

  setHovered(id: string | undefined): void {
    this.hovered = id;
    this.refreshHighlights();
  }

  private refreshHighlights(): void {
    for (const [id, node] of this.fish) {
      node.layers.highlight.visible = id === this.selected || id === this.hovered;
    }
    // Draw the selected fish on top so its outline is never hidden.
    const top = this.selected ? this.fish.get(this.selected) : undefined;
    if (top) this.fishLayer.setChildIndex(top.container, this.fishLayer.children.length - 1);
  }

  /** Advance every fish by `dt` seconds. */
  update(dt: number): void {
    for (const [id, node] of this.fish) {
      node.swim = step(node.swim, dt, this.rand, TANK_BOUNDS);
      if (hasLeft(node.swim, TANK_BOUNDS, FISH_W)) {
        node.container.destroy({ children: true });
        this.fish.delete(id);
        continue;
      }
      this.place(node);
    }
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
