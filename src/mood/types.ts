/** Mood tiers, from best to worst day. */
export const MOODS = ['ecstatic', 'happy', 'neutral', 'uneasy', 'sad'] as const;

export type Mood = (typeof MOODS)[number];
