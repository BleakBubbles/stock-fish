import type { Mood } from '../mood/types';
import type { FishView } from '../tank/model';
import { formatChangeRatio, formatDay, formatMoney } from './format';

const MOOD_WORD: Record<Mood, string> = {
  ecstatic: 'ecstatic',
  happy: 'happy',
  neutral: 'calm',
  uneasy: 'uneasy',
  sad: 'sad',
};

/**
 * What a screen reader says for one fish. `closedMarket` names its market
 * while it's closed (the fish is asleep).
 */
export function describeFish(f: FishView, penName?: string, closedMarket?: string): string {
  const parts = [f.name ? `${f.symbol}, ${f.name}` : f.symbol];
  if (f.quote && f.moodResult && f.stale) {
    parts.push(
      'no price yet today',
      `${formatChangeRatio(f.moodResult.todayReturn)} on ${formatDay(f.stale)}`,
      formatMoney(f.quantity * f.quote.price, f.quote.currency),
    );
  } else if (f.quote && f.moodResult) {
    parts.push(
      MOOD_WORD[f.mood],
      `${formatChangeRatio(f.moodResult.todayReturn)} today`,
      formatMoney(f.quantity * f.quote.price, f.quote.currency),
    );
  } else {
    parts.push(f.state === 'error' ? 'no price' : 'waiting for prices');
  }
  if (closedMarket) parts.push(`asleep, ${closedMarket} market closed`);
  if (penName) parts.push(`in ${penName}`);
  return parts.join(', ');
}
