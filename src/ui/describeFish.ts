import type { Mood } from '../mood/types';
import type { FishView } from '../tank/model';
import { formatChangeRatio, formatMoney } from './format';

const MOOD_WORD: Record<Mood, string> = {
  ecstatic: 'ecstatic',
  happy: 'happy',
  neutral: 'calm',
  uneasy: 'uneasy',
  sad: 'sad',
};

/** What a screen reader says for one fish. */
export function describeFish(f: FishView, penName?: string): string {
  const parts = [f.name ? `${f.symbol}, ${f.name}` : f.symbol];
  if (f.quote && f.moodResult) {
    parts.push(
      MOOD_WORD[f.mood],
      `${formatChangeRatio(f.moodResult.todayReturn)} today`,
      formatMoney(f.quantity * f.quote.price, f.quote.currency),
    );
  } else {
    parts.push(f.state === 'error' ? 'no price' : 'waiting for prices');
  }
  if (penName) parts.push(`in ${penName}`);
  return parts.join(', ');
}
