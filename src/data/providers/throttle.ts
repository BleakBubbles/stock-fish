/**
 * Spaces out requests to stay under a per-minute limit (Twelve Data's free
 * plan allows 8). A sliding window: a call waits until fewer than `perMinute`
 * calls started in the last 60 seconds.
 */
export interface Throttle {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export interface ThrottleOptions {
  perMinute: number;
  /** Injectable clock and timer for tests. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const WINDOW = 60_000;

export function createThrottle(options: ThrottleOptions): Throttle {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const starts: number[] = [];
  let queue: Promise<unknown> = Promise.resolve();

  async function waitForSlot(): Promise<void> {
    for (;;) {
      const t = now();
      while (starts.length && (starts[0] ?? 0) <= t - WINDOW) starts.shift();
      if (starts.length < options.perMinute) {
        starts.push(t);
        return;
      }
      await sleep((starts[0] ?? t) + WINDOW - t);
    }
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      // Calls take slots in the order they arrive.
      const slot = queue.then(waitForSlot);
      queue = slot.catch(() => undefined);
      return slot.then(task);
    },
  };
}
