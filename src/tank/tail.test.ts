import { describe, expect, it } from 'vitest';
import { STILL_TAIL, type TailState, stepTail, tailPose } from './tail';

const fixed = () => 0.5;

/** Run for `seconds` in 1/60 s frames, collecting the poses shown. */
function run(
  motion: Parameters<typeof stepTail>[2],
  seconds: number,
  speed = 10,
  start = STILL_TAIL,
) {
  let t: TailState = start;
  const poses: string[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    t = stepTail(t, 1 / 60, motion, speed, fixed);
    poses.push(tailPose(t));
  }
  return { t, poses };
}

const changes = (poses: string[]) => poses.filter((p, i) => i > 0 && p !== poses[i - 1]).length;

describe('tail wag', () => {
  it('swimming cycles through mid, up, mid, down', () => {
    const { poses } = run('swim', 1);
    expect(new Set(poses)).toEqual(new Set(['mid', 'up', 'down']));
  });

  it('wags faster when swimming faster, and faster still when hurrying', () => {
    const slow = changes(run('swim', 4, 6).poses);
    const fast = changes(run('swim', 4, 14).poses);
    const hurry = changes(run('hurry', 4, 14).poses);
    expect(fast).toBeGreaterThan(slow);
    expect(hurry).toBeGreaterThan(fast);
  });

  it('a resting fish holds still, with one flick every few seconds', () => {
    const { poses } = run('rest', 10);
    const moving = poses.filter((p) => p !== 'mid').length;
    expect(moving).toBeGreaterThan(0);
    expect(moving / poses.length).toBeLessThan(0.2);
    expect(poses.at(-1)).toBe('mid');
  });

  it('a sleeping fish never moves its tail', () => {
    const { poses } = run('asleep', 5, 10, { phase: 1.5, flick: 2, wait: 0 });
    expect(new Set(poses)).toEqual(new Set(['mid']));
  });
});
