import { describe, expect, it } from 'vitest';
import { type Box, NUDGE_MAX, placeLabels } from './labels';

const AREA: Box = { x: 0, y: 0, w: 200, h: 100 };
const text = (x: number, y: number) => ({ box: { x, y, w: 20, h: 7 }, away: 1 as const });
const badge = (x: number, y: number) => ({ box: { x, y, w: 7, h: 7 }, away: -1 as const });

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('placeLabels', () => {
  it('leaves labels at home when nothing is in the way', () => {
    const out = placeLabels(
      [
        { id: 'a', boxes: [text(10, 40), badge(16, 10)] },
        { id: 'b', boxes: [text(100, 40)] },
      ],
      AREA,
    );
    expect(out.get('a')?.nudges).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(out.get('b')?.boxes[0]).toEqual({ x: 100, y: 40, w: 20, h: 7 });
  });

  it('keeps the front fish at home and moves the one behind out of the way', () => {
    const out = placeLabels(
      [
        { id: 'front', boxes: [text(10, 40)] },
        { id: 'back', boxes: [text(14, 42)] },
      ],
      AREA,
    );
    const front = out.get('front')?.boxes[0];
    const back = out.get('back')?.boxes[0];
    expect(front).toEqual({ x: 10, y: 40, w: 20, h: 7 });
    expect(front && back && overlap(front, back)).toBe(false);
  });

  it('moves text down and badges up first', () => {
    const t = placeLabels(
      [
        { id: 'a', boxes: [text(10, 40)] },
        { id: 'b', boxes: [text(10, 40)] },
      ],
      AREA,
    );
    expect(t.get('b')?.boxes[0]?.y).toBeGreaterThan(40);
    const b = placeLabels(
      [
        { id: 'a', boxes: [badge(10, 40)] },
        { id: 'b', boxes: [badge(10, 40)] },
      ],
      AREA,
    );
    expect(b.get('b')?.boxes[0]?.y).toBeLessThan(40);
  });

  it('keeps a free earlier shift so labels do not hop about', () => {
    const homes = [
      { id: 'a', boxes: [text(10, 40)] },
      { id: 'b', boxes: [text(10, 40)] },
    ];
    // Last time b had moved sideways; that spot is still free, so it stays there.
    const out = placeLabels(homes, AREA, new Map([['b', [[24, 0] as const]]]));
    expect(out.get('b')?.nudges[0]).toEqual([24, 0]);
  });

  it('goes home again as soon as home is free', () => {
    const out = placeLabels(
      [{ id: 'b', boxes: [text(10, 40)] }],
      AREA,
      new Map([['b', [[0, 8] as const]]]),
    );
    expect(out.get('b')?.nudges[0]).toEqual([0, 0]);
  });

  it('hides a label when nowhere near is free', () => {
    const wall = { box: { x: 50 - NUDGE_MAX, y: 50 - NUDGE_MAX, w: 100, h: 50 }, away: 1 as const };
    const out = placeLabels(
      [
        { id: 'wall', boxes: [wall] },
        { id: 'b', boxes: [text(50, 50)] },
      ],
      AREA,
    );
    expect(out.get('b')?.boxes[0]).toBeUndefined();
    expect(out.get('b')?.nudges[0]).toEqual([0, 0]);
  });

  it('keeps every label inside the area', () => {
    const out = placeLabels(
      [
        { id: 'a', boxes: [text(190, 96)] },
        { id: 'b', boxes: [badge(-5, -3)] },
      ],
      AREA,
    );
    expect(out.get('a')?.boxes[0]).toEqual({ x: 180, y: 93, w: 20, h: 7 });
    expect(out.get('b')?.boxes[0]).toEqual({ x: 0, y: 0, w: 7, h: 7 });
  });
});
