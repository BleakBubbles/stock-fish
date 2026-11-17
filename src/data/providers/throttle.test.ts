import { describe, expect, it } from 'vitest';
import { createThrottle } from './throttle';

/** A fake clock whose sleep advances time instantly. */
function fakeTime() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('throttle', () => {
  it('lets the first N calls through, then waits for the window', async () => {
    const clock = fakeTime();
    const throttle = createThrottle({ perMinute: 3, ...clock });
    const startedAt: number[] = [];
    const calls = Array.from({ length: 7 }, () =>
      throttle.run(async () => {
        startedAt.push(clock.now());
      }),
    );
    await Promise.all(calls);
    expect(startedAt).toEqual([0, 0, 0, 60_000, 60_000, 60_000, 120_000]);
  });

  it('frees slots as time passes', async () => {
    const clock = fakeTime();
    const throttle = createThrottle({ perMinute: 2, ...clock });
    await throttle.run(async () => undefined);
    clock.advance(30_000);
    await throttle.run(async () => undefined);
    clock.advance(31_000); // first call is now 61 s old
    const before = clock.now();
    await throttle.run(async () => undefined);
    expect(clock.now()).toBe(before);
  });

  it('keeps going after a task fails', async () => {
    const throttle = createThrottle({ perMinute: 5, ...fakeTime() });
    await expect(throttle.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(throttle.run(async () => 'ok')).resolves.toBe('ok');
  });
});
