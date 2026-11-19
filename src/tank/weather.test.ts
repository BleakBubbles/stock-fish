import { describe, expect, it } from 'vitest';
import { WEATHERS } from '../mood';
import { seededRandom } from './decor';
import type { Rect } from './territory';
import {
  type Drop,
  LIGHT_ACROSS,
  type Ripple,
  RIPPLE_LIFE,
  WEATHER_LOOK,
  dropPixels,
  makeShafts,
  ripplePixels,
  shaftRows,
  stepRain,
} from './weather';

const WATER: Rect = { x: 2, y: 6, w: 316, h: 156 };
const inWater = (p: { x: number; y: number; w?: number }) =>
  p.x >= WATER.x &&
  p.x + (p.w ?? 1) <= WATER.x + WATER.w &&
  p.y >= WATER.y &&
  p.y < WATER.y + WATER.h;

describe('weather looks', () => {
  it('lights good days, rains on bad ones and leaves calm days alone', () => {
    expect(WEATHERS.every((w) => WEATHER_LOOK[w] !== undefined)).toBe(true);
    expect(WEATHER_LOOK.sunny.shafts).toBeGreaterThan(WEATHER_LOOK.fair.shafts);
    expect(WEATHER_LOOK.calm).toEqual({ shafts: 0, shaftAlpha: 0, rain: 0, wind: 0, gloom: 0 });
    expect(WEATHER_LOOK.stormy.rain).toBeGreaterThan(WEATHER_LOOK.rainy.rain);
    expect(WEATHER_LOOK.stormy.gloom).toBeGreaterThan(WEATHER_LOOK.rainy.gloom);
    for (const w of ['sunny', 'fair'] as const) expect(WEATHER_LOOK[w].rain).toBe(0);
  });
});

describe('light shafts', () => {
  const shafts = makeShafts(5, WATER, seededRandom('shafts'));

  it('are whole-pixel rows inside the water', () => {
    for (const t of [0, 3.3, 7.9]) {
      const rows = shaftRows(shafts, WATER, t);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(inWater(r), JSON.stringify(r)).toBe(true);
        for (const v of [r.x, r.y, r.w]) expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it('fan out from one light above: leaning away from it and widening downwards', () => {
    const lightX = WATER.x + WATER.w * LIGHT_ACROSS;
    const rowsOf = (x: number) => shaftRows([{ x, w: 20, phase: 0 }], WATER, 0);
    const centre = (r: { x: number; w: number } | undefined) => (r ? r.x + r.w / 2 : NaN);
    const left = rowsOf(lightX - 80);
    const right = rowsOf(lightX + 80);
    expect(centre(left[100])).toBeLessThan(centre(left[0]));
    expect(centre(right[100])).toBeGreaterThan(centre(right[0]));
    expect(right[100]?.w).toBeGreaterThan(right[0]?.w ?? Infinity);
  });

  it('fade in three bands from the surface to the floor', () => {
    const rows = shaftRows(shafts, WATER, 0);
    expect(new Set(rows.map((r) => r.band))).toEqual(new Set([0, 1, 2]));
    const top = rows.filter((r) => r.band === 0).map((r) => r.y);
    const floor = rows.filter((r) => r.band === 2).map((r) => r.y);
    expect(Math.max(...top)).toBeLessThan(Math.min(...floor));
  });

  it('drift slowly: a few pixels, never jumps', () => {
    const a = shaftRows(shafts, WATER, 1);
    const b = shaftRows(shafts, WATER, 1 + 1 / 60);
    expect(a.length).toBe(b.length);
    a.forEach((r, i) => expect(Math.abs((b[i]?.x ?? r.x) - r.x)).toBeLessThanOrEqual(1));
  });
});

describe('rain', () => {
  function simulate(seconds: number, look = WEATHER_LOOK.stormy) {
    const rand = seededRandom('rain');
    let drops: Drop[] = [];
    let ripples: Ripple[] = [];
    let landed = 0;
    let onScreen = 0;
    const frames = seconds * 60;
    for (let i = 0; i < frames; i++) {
      ({ drops, ripples } = stepRain(drops, ripples, 1 / 60, look, WATER, rand));
      landed += ripples.filter((r) => r.age === 0).length;
      onScreen += drops.length;
    }
    return { drops, ripples, landed, average: onScreen / frames };
  }

  it('lands about `rain` drops a second, each falling on from its ripple', () => {
    const { landed } = simulate(20);
    expect(landed / 20).toBeGreaterThan(WEATHER_LOOK.stormy.rain * 0.8);
    expect(landed / 20).toBeLessThan(WEATHER_LOOK.stormy.rain * 1.2);
  });

  it('keeps a steady shower in the water (drops fall through and leave at the floor)', () => {
    const { average, drops } = simulate(20);
    expect(average).toBeGreaterThan(10);
    for (const d of drops) expect(d.y).toBeLessThan(WATER.y + WATER.h);
  });

  it('draws nothing on a dry day', () => {
    const { drops, ripples } = simulate(5, WEATHER_LOOK.sunny);
    expect(drops).toEqual([]);
    expect(ripples).toEqual([]);
  });

  it('draws whole pixels inside the water, slanting with the wind', () => {
    const d: Drop = { x: 100.4, y: 50.7, speed: 90 };
    const still = dropPixels(d, 0, WATER);
    const windy = dropPixels(d, 1, WATER);
    expect(still.map((p) => p.x)).toEqual([100, 100, 100]);
    expect(windy.map((p) => p.x)).toEqual([100, 99, 98]);
    for (const p of [...still, ...windy]) expect(inWater(p)).toBe(true);
    expect(dropPixels({ x: 500, y: 50, speed: 90 }, 0, WATER)).toEqual([]);
  });

  it('spreads each ripple into two arcs on the surface', () => {
    const start = ripplePixels({ x: 50, age: 0 }, WATER);
    const late = ripplePixels({ x: 50, age: RIPPLE_LIFE * 0.99 }, WATER);
    expect(start.every((p) => p.x === 50)).toBe(true);
    expect(Math.max(...late.map((p) => p.x)) - Math.min(...late.map((p) => p.x))).toBeGreaterThan(
      4,
    );
    for (const p of [...start, ...late]) expect(p.y === WATER.y || p.y === WATER.y + 1).toBe(true);
  });
});
