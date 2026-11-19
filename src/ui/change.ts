/**
 * How today's change is marked, as on a price board: an arrow for its
 * direction and a colour that repeats it. Which colour means up is the user's
 * choice (green in most places; red in China, Japan, Korea and Taiwan).
 */
import type { UpColour } from '../data/model';
import type { IconName } from './pixel/PixelIcon';
import type { Tone } from './pixel/tones';

export type Direction = 'up' | 'down' | 'flat';

export function direction(change: number): Direction {
  if (!Number.isFinite(change) || change === 0) return 'flat';
  return change > 0 ? 'up' : 'down';
}

/** The arrow for a direction; none when flat. */
export function directionIcon(d: Direction): IconName | undefined {
  return d === 'flat' ? undefined : d;
}

/** The text tone for a direction: green or red as the user chose, plain when flat. */
export function directionTone(d: Direction, upColour: UpColour = 'green'): Tone {
  if (d === 'flat') return 'text';
  const rising = d === 'up';
  return rising === (upColour === 'green') ? 'changeGreen' : 'changeRed';
}
