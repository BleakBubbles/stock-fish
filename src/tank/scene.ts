/**
 * The tank scene in art pixels (at the tank's native size). Framework-free: Tank.tsx owns the
 * PixiJS application and renders this scene into a low-res render texture,
 * which is then upscaled by a whole number (CLAUDE.md, firm rule 4).
 */
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { RegroupSpeed } from '../data/model';
import type { Mood, Weather } from '../mood';
import { css, ui } from '../theme';
import { drawText, measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { atlasFrames, frameRect } from '../theme/atlas';
import { decorColour, decorFrames, decorItems, frameRows, sand } from '../theme/decor';
import type { AtlasLayer, TailPose } from '../theme/grid';
import type { Body, Face } from '../theme/sprites';
import { NIGHT_ALPHA, TAP_SLOP } from './constants';
import {
  DEFAULT_GEOMETRY,
  type Region,
  type TankGeometry,
  boundsFor,
  tankGeometry,
} from './arrange';
import { SWAY_PERIOD, decorLayout } from './decor';
import {
  type Drop,
  type Ripple,
  type Shaft,
  WEATHER_LOOK,
  dropPixels,
  makeShafts,
  ripplePixels,
  shaftRows,
  stepRain,
} from './weather';
import { STILL_TAIL, type TailMotion, type TailState, stepTail, tailPose } from './tail';
import type { Rect } from './territory';
import {
  type Bounds,
  type Rand,
  type SwimState,
  hasLeft,
  leave,
  HURRY_SPEEDUP,
  arrive,
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
  /** Its colour (hex), repeating its sign as on a price board; white when unset. */
  changeColour?: string;
  /** Whether the mood is known (a badge would otherwise claim "calm" without data). */
  moodKnown: boolean;
  /** Temperament, 0 (calm) to 1 (jittery), from typical volatility (src/mood/temperament.ts). */
  temper: number;
}

/** One line of a fish's label, in its colour (hex; white when unset). */
interface LabelLine {
  text: string;
  colour?: string;
}

const labelKey = (lines: readonly LabelLine[]) =>
  lines.map((l) => `${l.colour ?? ''}:${l.text}`).join('\n');

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
  /** What the text sprite shows, to skip redrawing it. */
  textKey: string;
}

/**
 * Labels in the UI font, in label pixels (the larger of an art pixel and a UI
 * pixel: they grow with the fish, but never below the app's text size): each
 * line is 7 rows
 * (the capitals on rows 1–5, with a row of outline above and below), so the
 * font's 9-row glyphs are drawn 2 rows up. One pixel of outline each side.
 */
const LABEL_LINE = 7;
const LABEL_FONT_TOP = -2;
const LABEL_PAD = 1;
/**
 * Where labels sit, in art pixels from the fish's top-left: text from just
 * below the body, the badge ending just above the head.
 */
const LABEL_BELOW = 23;
const BADGE_BOTTOM = 1;
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

/** The tank frame stretched to a size, drawn once into its own texture. */
function frameTexture(width: number, height: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    frameRows(width, height).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x] ?? '.';
        if (ch === '.') continue;
        ctx.fillStyle = css(decorColour(ch));
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

/** A plant that sways between its still and swayed frames. */
interface Swayer {
  sprite: Sprite;
  frames: [Texture, Texture];
  phase: number;
}
/**
 * Fish at night: about what the night overlay does to the water (blending
 * NIGHT_ALPHA of the night colour over it), as a tint, so their labels can
 * stay bright in front of the overlay.
 */
const NIGHT_TINT = (() => {
  const n = Number.parseInt(ui.night, 16);
  const mix = (shift: number) =>
    Math.round(255 * (1 - NIGHT_ALPHA) + ((n >> shift) & 0xff) * NIGHT_ALPHA);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
})();

/**
 * How many times their cruising speed fish swim to new places after a
 * rearrangement, by the user's setting (instant places them at once).
 */
const REGROUP_SPEEDUP: Record<RegroupSpeed, number> = {
  slow: 2,
  normal: HURRY_SPEEDUP,
  fast: 10,
  instant: HURRY_SPEEDUP,
};

/** Rain streaks are see-through, so they don't hide the fish. */
const RAIN_ALPHA = 0.5;
/** At night the water is calm: plants sway at this fraction of their usual pace. */
const NIGHT_SWAY = 0.5;

export class TankScene {
  /** Everything drawn in the tank, in art pixels. Render this into the low-res texture. */
  readonly root = new Container();
  /**
   * Art pixels per label pixel, a whole number: 1, or more where the UI's
   * pixels are bigger than the tank's (phones), so labels are never smaller
   * than the app's text and stay crisp.
   */
  private labelScale = 1;
  /**
   * Swimming pace: zoomed in, art pixels are bigger on screen, so fish swim
   * that much slower in art pixels and cross the tank in about the same time.
   */
  private swimPace = 1;
  /** How fast fish swim to new places after a rearrangement (setRegroupSpeed). */
  private regroupSpeed: RegroupSpeed = 'normal';
  private readonly fishLayer = new Container();
  private readonly night = new Graphics();
  /** Weather (./weather.ts): light shafts and gloom over the fish, raindrop ripples at the surface. */
  private readonly shaftLayer = new Graphics();
  private readonly gloom = new Graphics();
  private readonly rippleLayer = new Graphics();
  private weather: Weather = 'calm';
  private shafts: Shaft[] = [];
  private shaftKey = '';
  private ripples: Ripple[] = [];
  private drops: Drop[] = [];
  private weatherClock = 0;
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
  /** The tank's size and water (it grows to fill its space: setSize). */
  private geo: TankGeometry = DEFAULT_GEOMETRY;
  /** The whole water, for fish without a region (and for leaving). */
  private bounds: Bounds = boundsFor(DEFAULT_GEOMETRY.water);
  /** Around the tank: the room (the slot's colour), where the stand's legs stand. */
  private readonly room = new Graphics();
  private readonly waterFill = new Graphics();
  private readonly frameSprite = new Sprite();
  /** Plants behind the sand's edge, the sand, then rocks and low plants in front of it. */
  private readonly decorBack = new Container();
  private readonly sandLayer = new Graphics();
  private readonly decorFront = new Container();
  private decorSeed?: string;
  private swayers: Swayer[] = [];
  private swayClock = 0;
  private labels: SceneLabels = { ticker: false, change: false, mood: false };
  /** Label textures by their text, shared by fish that say the same thing. */
  private readonly labelTextures = new Map<string, Texture>();

  constructor(
    private readonly atlas: Texture,
    private readonly decorAtlas: Texture,
    private readonly rand: Rand = Math.random,
  ) {
    this.night.visible = false;
    this.drawTank();
    // The water, its floor and the weather, then the night overlay over them.
    // Each fish and its labels in front: fish dim at night by a tint instead,
    // so labels stay readable, and a fish in front covers both the fish behind
    // and its labels. Fish swim behind the frame, so leaving fish slip out of
    // sight past the glass. Z's float above everything, readable at night.
    this.root.addChild(
      this.room,
      this.waterFill,
      this.decorBack,
      this.sandLayer,
      this.decorFront,
      this.shaftLayer,
      this.gloom,
      this.rippleLayer,
      this.patchOutline,
      this.night,
      this.fishLayer,
      this.frameSprite,
      this.zedLayer,
    );
  }

  /**
   * The tank's size in art pixels. Everything that depends on it (the room,
   * water, frame, sand and plants, weather, swimming bounds) is redrawn; fish
   * head back inside if the tank shrank under them.
   */
  setSize(width: number, height: number): void {
    if (width === this.geo.width && height === this.geo.height) return;
    this.geo = tankGeometry(width, height);
    this.bounds = boundsFor(this.geo.water);
    this.drawTank();
    const seed = this.decorSeed;
    this.decorSeed = undefined;
    if (seed !== undefined) this.setDecor(seed);
    const weather = this.weather;
    this.weather = 'calm';
    this.setWeather(weather);
    this.ripples = [];
    this.drops = [];
    for (const [id, node] of this.fish) {
      if (id !== this.drag?.id && !node.swim.leaving) {
        node.swim = regroup(node.swim, this.boundsOf(id), this.rand);
      }
    }
    this.layoutLabels();
  }

  /**
   * How the tank is drawn: `labels` is art pixels per label pixel (a whole
   * number, see labelScale); `pace` slows swimming in art pixels as the tank
   * zooms in (1 at normal zoom).
   */
  setZoom({ labels, pace }: { labels: number; pace: number }): void {
    this.swimPace = pace;
    const scale = Math.max(1, Math.round(labels));
    if (scale === this.labelScale) return;
    this.labelScale = scale;
    this.layoutLabels();
  }

  /** The room, the water, the night overlay and the frame, at the tank's size. */
  private drawTank(): void {
    const { width, height, inner } = this.geo;
    const { x, y, w, h } = inner;
    this.room.clear().rect(0, 0, width, height).fill(css(ui.night));
    this.waterFill.clear().rect(x, y, w, h).fill(css(ui.water));
    // The light goes off in the water; the frame stays as it is.
    this.night
      .clear()
      .rect(x, y, w, h)
      .fill({ color: css(ui.night), alpha: NIGHT_ALPHA });
    const old = this.frameSprite.texture;
    this.frameSprite.texture = frameTexture(width, height);
    if (old !== Texture.EMPTY) old.destroy(true);
  }

  /** Which labels to draw with the fish. */
  setLabels(labels: SceneLabels): void {
    this.labels = { ...labels };
    for (const node of this.fish.values()) this.updateLabel(node);
    this.layoutLabels();
  }

  /** A label's texture: its lines in their colours, outlined in the night colour, drawn once per text. */
  private labelTexture(lines: readonly LabelLine[]): Texture {
    const key = labelKey(lines);
    let texture = this.labelTextures.get(key);
    if (!texture) {
      const texts = lines.map((l) => normalizeText(uiFont, l.text));
      const width = Math.max(...texts.map((t) => measureText(uiFont, t))) + 2 * LABEL_PAD;
      const height = texts.length * LABEL_LINE;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Letters with a one-pixel dark outline (all 8 neighbours): readable on
        // water, sand and plants without hiding them behind a box.
        const draw = (dx: number, dy: number, colour?: string) =>
          texts.forEach((t, i) => {
            // Centre each line on whole pixels (an odd remainder goes to the right).
            const x = Math.floor((width - measureText(uiFont, t)) / 2);
            const fill = colour ?? css(lines[i]?.colour ?? ui.text);
            drawText(ctx, uiFont, t, x + dx, i * LABEL_LINE + LABEL_FONT_TOP + dy, fill);
          });
        for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) draw(dx, dy, css(ui.night));
        draw(0, 0);
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
    const lines: LabelLine[] = [
      ...(this.labels.ticker ? [{ text: spec.symbol }] : []),
      ...(this.labels.change && spec.change
        ? [{ text: spec.change, colour: spec.changeColour }]
        : []),
    ];
    const key = labelKey(lines);
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
    const { inner, sandTop } = this.geo;
    const layout = decorLayout(seed, inner, sandTop, decorItems());
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
    const bottom = inner.y + inner.h;
    layout.sandTops.forEach((top, i) => g.rect(inner.x + i, top + 1, 1, bottom - top - 1));
    g.fill(css(sand.base));
    layout.sandTops.forEach((top, i) => g.rect(inner.x + i, top, 1, 1));
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
        node.swim = leave(node.swim, this.bounds, FISH_W);
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
    const node: FishNode = {
      spec,
      tail: STILL_TAIL,
      shown: '',
      labelGroup,
      text,
      badge,
      textKey: '',
      swim: parked
        ? resume(parked, this.boundsOf(spec.id), this.rand)
        : spawn(this.rand, this.boundsOf(spec.id), spec.temper),
      container,
      layers,
    };
    this.applySpec(node, spec, true);
    this.fish.set(spec.id, node);
    this.fishLayer.addChild(container, labelGroup);
    container.tint = this.asleep ? NIGHT_TINT : 0xffffff;
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
    // A new temperament (σ arrived or changed) shows from the fish's next leg.
    node.swim = { ...node.swim, temper: spec.temper };
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
    const instant = this.regroupSpeed === 'instant';
    for (const [id, node] of this.fish) {
      if (id === this.drag?.id) continue;
      node.swim = regroup(node.swim, this.boundsOf(id), this.rand);
      if (instant) {
        node.swim = arrive(node.swim);
        this.place(node);
      }
    }
    if (instant) this.layoutLabels();
    this.drawPatch();
  }

  /** How fast fish move to their new places when the grouping or order changes. */
  setRegroupSpeed(speed: RegroupSpeed): void {
    this.regroupSpeed = speed;
  }

  private boundsOf(id: string): Bounds {
    const region = this.regionOf.get(id);
    const b = region ? boundsFor(region.rect, this.geo.water) : this.bounds;
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
    const nx = Math.min(this.bounds.maxX, Math.max(this.bounds.minX, x - this.drag.dx));
    const ny = Math.min(this.bounds.maxY, Math.max(this.bounds.minY, y - this.drag.dy));
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
    // The overlay dims the water; fish (not their labels) dim by a tint.
    for (const node of this.fish.values()) node.container.tint = on ? NIGHT_TINT : 0xffffff;
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
      const pace = (sleeping ? SLEEP_SPEED : 1) * this.swimPace;
      const hurry = REGROUP_SPEEDUP[this.regroupSpeed];
      node.swim = step(node.swim, dt * pace, this.rand, this.boundsOf(id), hurry);
      if (sleeping && !node.swim.leaving && this.rand() < dt * ZED_RATE) this.breathe(node);
      if (hasLeft(node.swim, this.bounds, FISH_W)) {
        this.removeNode(id, node);
        continue;
      }
      this.place(node);
    }
    this.layoutLabels();
    this.updateZeds(dt);
    this.updateSway(dt);
    this.updateWeather(dt);
  }

  /** The portfolio weather to show in the water. */
  setWeather(weather: Weather): void {
    if (weather === this.weather) return;
    this.weather = weather;
    const look = WEATHER_LOOK[weather];
    this.shafts = makeShafts(look.shafts, this.geo.water, this.rand);
    this.shaftKey = '';
    if (!look.rain) {
      this.ripples = [];
      this.drops = [];
    }
    const { x, y, w, h } = this.geo.inner;
    this.gloom.clear();
    if (look.gloom > 0)
      this.gloom.rect(x, y, w, h).fill({ color: css(ui.night), alpha: look.gloom });
    this.updateWeather(0);
  }

  /** Drift the light shafts (redrawn only when a whole pixel changes) and the ripples. */
  private updateWeather(dt: number): void {
    const look = WEATHER_LOOK[this.weather];
    this.weatherClock += dt;
    // At night the shafts sit under the dimmed water: faint moonlight, still showing the day.
    const rows = shaftRows(this.shafts, this.geo.water, this.weatherClock);
    const key = rows.map((r) => `${r.x},${r.w}`).join(';');
    if (key !== this.shaftKey) {
      this.shaftKey = key;
      const g = this.shaftLayer.clear();
      const fade = [1, 0.6, 0.3] as const;
      for (const band of [0, 1, 2] as const) {
        const inBand = rows.filter((r) => r.band === band);
        for (const r of inBand) g.rect(r.x, r.y, r.w, 1);
        if (inBand.length) {
          g.fill({ color: css(ui.sunlight), alpha: look.shaftAlpha * fade[band] });
        }
      }
    }
    ({ drops: this.drops, ripples: this.ripples } = stepRain(
      this.drops,
      this.ripples,
      dt,
      look,
      this.geo.water,
      this.rand,
    ));
    const g = this.rippleLayer.clear();
    const water = this.geo.water;
    for (const r of this.ripples) for (const p of ripplePixels(r, water)) g.rect(p.x, p.y, 1, 1);
    if (this.ripples.length) g.fill(css(ui.ripple));
    for (const d of this.drops)
      for (const p of dropPixels(d, look.wind, water)) g.rect(p.x, p.y, 1, 1);
    if (this.drops.length) g.fill({ color: css(ui.ripple), alpha: RAIN_ALPHA });
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
   * fish, the badge over it, kept inside the glass. Each fish's labels sit
   * just in front of it in the fish layer, so where fish crowd, a fish in
   * front covers the fish behind and its labels too. A fish swimming away
   * takes no labels with it.
   */
  private layoutLabels(): void {
    const byContainer = new Map([...this.fish.values()].map((n) => [n.container as unknown, n]));
    const backToFront = this.fishLayer.children.flatMap((c) => byContainer.get(c) ?? []);
    // Fish and labels in pairs: fish, its labels, next fish, its labels, ...
    let i = 0;
    for (const node of backToFront) {
      for (const child of [node.container, node.labelGroup]) {
        if (this.fishLayer.children[i] !== child) this.fishLayer.setChildIndex(child, i);
        i++;
      }
    }
    // Labels in art pixels, each label pixel `m` art pixels square.
    const m = this.labelScale;
    const inner = this.geo.inner;
    const keepIn = (sprite: Sprite, x: number, y: number, w: number, h: number) => {
      sprite.scale.set(m);
      sprite.position.set(
        Math.max(inner.x, Math.min(inner.x + inner.w - w, x)),
        Math.max(inner.y, Math.min(inner.y + inner.h - h, y)),
      );
    };
    for (const node of backToFront) {
      node.labelGroup.visible = !node.swim.leaving;
      if (node.swim.leaving) continue;
      const x = Math.round(node.swim.x);
      const y = Math.round(node.swim.y);
      const centre = x + Math.floor(FISH_W / 2);
      if (node.text.visible) {
        const w = node.text.texture.width * m;
        const h = node.text.texture.height * m;
        keepIn(node.text, centre - Math.floor(w / 2), y + LABEL_BELOW, w, h);
      }
      if (node.badge.visible) {
        const size = BADGE_SIZE * m;
        keepIn(node.badge, centre - Math.floor(size / 2), y + BADGE_BOTTOM - size, size, size);
      }
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
