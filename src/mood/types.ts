/** Mood tiers, from best to worst day. The tier logic itself comes in milestone 3. */
export const MOODS = ['ecstatic', 'happy', 'neutral', 'uneasy', 'sad'] as const;

export type Mood = (typeof MOODS)[number];
