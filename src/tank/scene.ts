/**
 * The tank scene in art pixels (320 × 180). Framework-free: Tank.tsx owns the
 * PixiJS application and renders this scene into a low-res render texture,
 * which is then upscaled by a whole number (CLAUDE.md, firm rule 4).
 */
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Mood } from '../mood/types';
import { css, ui } from '../theme';
import { drawText, measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { atlasFrames, frameRect } from '../theme/atlas';
import { decorFrames, decorItems, sand } from '../theme/decor';
import type { AtlasLayer, TailPose } from '../theme/grid';
import type { Body, Face } from '../theme/sprites';
import { NIGHT_ALPHA, TANK_HEIGHT, TANK_WIDTH, TAP_SLOP } from './constants';
import { INNER_WATER, type Region, SAND_TOP, WATER, boundsFor } from './arrange';
import { SWAY_PERIOD, decorLayout } from './decor';
import { type Box, type LabelHome, type Nudge, placeLabels } from './labels';
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
  /** For the ticker label. */
  symbol: string;
  /** Today's change, formatted (e.g. "+1.2%"), once there's a price. */
  change?: string;
  /** Whether the mood is known (a badge would otherwise claim "calm" without data). */
  moodKnown: boolean;
}

/** Labels drawn with every fish. */
export interface SceneLabels {
  ticker: boolean;
  change: boolean;
  mood: boolean;
}

interface FishNode {
  spec: SceneFish;
  swim: SwimState;
  container: Container;
  layers: Record<AtlasLayer, Sprite>;
  tail: TailState;
  /** The frame on screen ("face/tail"), to skip texture swaps that change nothing. */
  shown: string;
  /**
   * Text under the fish (ticker and/or change) and the mood badge above it, in
   * one group so the labels stack in the same order as the fish.
   */
  labelGroup: Container;
  text: Sprite;
  badge: Sprite;
  /** Where crowding last pushed the labels, so they don't hop about. */
  nudges: readonly Nudge[];
  /** What the text sprite shows, to skip redrawing it. */
  textKey: string;
}

/**
 * Labels in the UI font, in art pixels: each line is 7 rows (the capitals on
 * rows 1–5, with a row of outline above and below), so the font's 9-row glyphs
 * are drawn 2 rows up. One pixel of outline each side.
 */
const LABEL_LINE = 7;
const LABEL_FONT_TOP = -2;
const LABEL_PAD = 1;
/** Where labels sit relative to the fish's top-left: text below the body, badge above. */
const LABEL_BELOW = 23;
const BADGE_ABOVE = 8;
const BADGE_SIZE = 9;

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
export const TANK_BOUNDS: Bounds = boundsFor(WATER);

/** A plant that sways between its still and swayed frames. */
interface Swayer {
  sprite: Sprite;
  frames: [Texture, Texture];
  phase: number;
}
/** At night the water is calm: plants sway at this fraction of their usual pace. */
const NIGHT_SWAY = 0.5;

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
  /** Plants behind the sand's edge, the sand, then rocks and low plants in front of it. */
  private readonly decorBack = new Container();
  private readonly sandLayer = new Graphics();
  private readonly decorFront = new Container();
  private decorSeed?: string;
  private swayers: Swayer[] = [];
  private swayClock = 0;
  /** Tickers, changes and mood badges, above the fish (and the night overlay, to stay readable). */
  private readonly labelLayer = new Container();
  private labels: SceneLabels = { ticker: false, change: false, mood: false };
  /** Label textures by their text, shared by fish that say the same thing. */
  private readonly labelTextures = new Map<string, Texture>();

  constructor(
    private readonly atlas: Texture,
    private readonly decorAtlas: Texture,
    private readonly rand: Rand = Math.random,
  ) {
    // Around the tank: the room (the slot's colour), where the stand's legs stand.
    const room = new Graphics().rect(0, 0, TANK_WIDTH, TANK_HEIGHT).fill(css(ui.night));
    const { x, y, w, h } = INNER_WATER;
    const water = new Graphics().rect(x, y, w, h).fill(css(ui.water));
    // The light goes off in the water; the frame stays as it is.
    this.night.rect(x, y, w, h).fill({ color: css(ui.night), alpha: NIGHT_ALPHA });
    this.night.visible = false;
    const frame = new Sprite(this.decorTexture('frame'));
    // Fish swim behind the frame, so leaving fish slip out of sight past the glass.
    // Z's float above the dimmed tank, so they're readable at night.
    this.root.addChild(
      room,
      water,
      this.decorBack,
      this.sandLayer,
      this.decorFront,
      this.patchOutline,
      this.fishLayer,
      this.night,
      this.labelLayer,
      frame,
      this.zedLayer,
    );
  }

  /** Which labels to draw with the fish. */
  setLabels(labels: SceneLabels): void {
    this.labels = { ...labels };
    for (const node of this.fish.values()) this.updateLabel(node);
    this.layoutLabels();
  }

  /** A label's texture: its lines in white, outlined in the night colour, drawn once per text. */
  private labelTexture(lines: readonly string[]): Texture {
    const key = lines.join('\n');
    let texture = this.labelTextures.get(key);
    if (!texture) {
      const texts = lines.map((l) => normalizeText(uiFont, l));
      const width = Math.max(...texts.map((t) => measureText(uiFont, t))) + 2 * LABEL_PAD;
      const height = texts.length * LABEL_LINE;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // White letters with a one-pixel dark outline (all 8 neighbours): readable on
        // water, sand and plants without hiding them behind a box.
        const draw = (dx: number, dy: number, colour: string) =>
          texts.forEach((t, i) => {
            // Centre each line on whole pixels (an odd remainder goes to the right).
            const x = Math.floor((width - measureText(uiFont, t)) / 2);
            drawText(ctx, uiFont, t, x + dx, i * LABEL_LINE + LABEL_FONT_TOP + dy, colour);
          });
        for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) draw(dx, dy, css(ui.night));
        draw(0, 0, css(ui.text));
      }
      texture = Texture.from(canvas);
      texture.source.scaleMode = 'nearest';
      this.labelTextures.set(key, texture);
    }
    return texture;
  }

  /** Show the labels this fish should have now. */
  private updateLabel(node: FishNode): void {
    const { spec } = node;
    const lines = [
      ...(this.labels.ticker ? [spec.symbol] : []),
      ...(this.labels.change && spec.change ? [spec.change] : []),
    ];
    const key = lines.join('\n');
    if (key !== node.textKey) {
      node.textKey = key;
      node.text.visible = lines.length > 0;
      if (lines.length) node.text.texture = this.labelTexture(lines);
    }
    node.badge.visible = this.labels.mood && spec.moodKnown;
    if (node.badge.visible) node.badge.texture = this.decorTexture(`badge-${spec.mood}`);
  }

  private decorTexture(name: string): Texture {
    const key = `decor/${name}`;
    let texture = this.frames.get(key);
    if (!texture) {
      const f = decorFrames[name];
      if (!f) throw new Error(`No decor frame ${name}`);
      texture = new Texture({
        source: this.decorAtlas.source,
        frame: new Rectangle(f.x, f.y, f.w, f.h),
      });
      this.frames.set(key, texture);
    }
    return texture;
  }

  /** Lay out a tank's floor: the same seed always gives the same sand, plants and rocks. */
  setDecor(seed: string): void {
    if (seed === this.decorSeed) return;
    this.decorSeed = seed;
    for (const layer of [this.decorBack, this.decorFront]) {
      for (const child of layer.removeChildren()) child.destroy();
    }
    this.swayers = [];
    const layout = decorLayout(seed, INNER_WATER, SAND_TOP, decorItems());
    for (const item of layout.items) {
      const still = this.decorTexture(item.name);
      const sprite = new Sprite(still);
      sprite.position.set(item.x, item.y);
      (item.front ? this.decorFront : this.decorBack).addChild(sprite);
      if (item.sway) {
        this.swayers.push({
          sprite,
          frames: [still, this.decorTexture(`${item.name}-sway`)],
          phase: item.phase,
        });
      }
    }
    // Sand: one column at a time (its pale top edge, then the sand), then the specks.
    const g = this.sandLayer.clear();
    const bottom = INNER_WATER.y + INNER_WATER.h;
    layout.sandTops.forEach((top, i) => g.rect(INNER_WATER.x + i, top + 1, 1, bottom - top - 1));
    g.fill(css(sand.base));
    layout.sandTops.forEach((top, i) => g.rect(INNER_WATER.x + i, top, 1, 1));
    g.fill(css(sand.edge));
    for (const { x, y } of layout.specks) g.rect(x, y, 1, 1);
    if (layout.specks.length) g.fill(css(sand.speck));
  }

  /** Plants sway: half of each cycle still, half swayed, each on its own phase. */
  private updateSway(dt: number): void {
    this.swayClock += this.asleep ? dt * NIGHT_SWAY : dt;
    for (const s of this.swayers) {
      const t = (this.swayClock + s.phase) % SWAY_PERIOD;
      const texture = s.frames[t < SWAY_PERIOD / 2 ? 0 : 1];
      if (s.sprite.texture !== texture) s.sprite.texture = texture;
    }
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
        this.removeNode(id, node);
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
    const text = new Sprite();
    const badge = new Sprite();
    text.visible = false;
    badge.visible = false;
    const labelGroup = new Container();
    labelGroup.addChild(text, badge);
    this.labelLayer.addChild(labelGroup);
    const node: FishNode = {
      spec,
      tail: STILL_TAIL,
      shown: '',
      labelGroup,
      text,
      badge,
      nudges: [],
      textKey: '',
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
    this.layoutLabels();
  }

  private applySpec(node: FishNode, spec: SceneFish, force = false): void {
    const old = node.spec;
    node.spec = spec;
    if (force || old.body !== spec.body || old.mood !== spec.mood) node.shown = '';
    this.showFrame(node);
    node.layers.body.tint = css(spec.primary);
    node.layers.fin.tint = css(spec.secondary);
    node.spec = spec;
    this.updateLabel(node);
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
    this.layoutLabels();
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
    this.layoutLabels();
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
        this.removeNode(id, node);
        continue;
      }
      this.place(node);
    }
    this.layoutLabels();
    this.updateZeds(dt);
    this.updateSway(dt);
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

  /**
   * Put every label by its fish. Labels never mirror: text centred under the
   * fish, the badge over it, kept inside the glass. Labels stack like the fish
   * (the fish in front has its labels in front, at home); where fish crowd, the
   * labels of fish further back move to the nearest free spot, or hide when
   * there is none. A fish swimming away takes no labels with it.
   */
  private layoutLabels(): void {
    const byContainer = new Map([...this.fish.values()].map((n) => [n.container as unknown, n]));
    const backToFront = this.fishLayer.children.flatMap((c) => byContainer.get(c) ?? []);
    backToFront.forEach((node, i) => {
      if (this.labelLayer.children[i] !== node.labelGroup) {
        this.labelLayer.setChildIndex(node.labelGroup, i);
      }
    });
    const homes: LabelHome[] = [];
    const sprites = new Map<string, Sprite[]>();
    for (const node of [...backToFront].reverse()) {
      node.labelGroup.visible = !node.swim.leaving;
      if (node.swim.leaving) continue;
      const x = Math.round(node.swim.x);
      const y = Math.round(node.swim.y);
      const boxes: { box: Box; away: 1 | -1 }[] = [];
      const shown: Sprite[] = [];
      if (node.text.visible) {
        const { width: w, height: h } = node.text.texture;
        const box = { x: x + Math.floor((FISH_W - w) / 2), y: y + LABEL_BELOW, w, h };
        boxes.push({ box, away: 1 });
        shown.push(node.text);
      }
      if (node.badge.visible) {
        const box: Box = {
          x: x + Math.floor((FISH_W - BADGE_SIZE) / 2),
          y: y - BADGE_ABOVE,
          w: BADGE_SIZE,
          h: BADGE_SIZE,
        };
        boxes.push({ box, away: -1 });
        shown.push(node.badge);
      }
      homes.push({ id: node.spec.id, boxes });
      sprites.set(node.spec.id, shown);
    }
    const previous = new Map([...this.fish.values()].map((n) => [n.spec.id, n.nudges]));
    for (const [id, { boxes, nudges }] of placeLabels(homes, INNER_WATER, previous)) {
      const node = this.fish.get(id);
      if (node) node.nudges = nudges;
      sprites.get(id)?.forEach((sprite, i) => {
        const box = boxes[i];
        sprite.renderable = box !== undefined;
        if (box) sprite.position.set(box.x, box.y);
      });
    }
  }

  /** Remove a fish and its labels from the scene. */
  private removeNode(id: string, node: FishNode): void {
    node.container.destroy({ children: true });
    node.labelGroup.destroy({ children: true });
    this.fish.delete(id);
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
    for (const texture of this.labelTextures.values()) texture.destroy(true);
    this.root.destroy({ children: true });
  }
}
