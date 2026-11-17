/**
 * Mood engine (CLAUDE.md, firm rule 6): pure functions, no React, PixiJS,
 * storage or network. Every function here has unit tests.
 */
export { MOODS, type Mood } from './types';
export {
  DEFAULT_THRESHOLDS,
  MIN_SIGMA,
  type MoodInput,
  type MoodReason,
  type MoodResult,
  type TierThresholds,
  assessMood,
  tierFor,
} from './tiers';
export {
  type Bar,
  MIN_RETURNS,
  VOLATILITY_WINDOW,
  completedBars,
  typicalVolatility,
} from './volatility';
export {
  MIN_DAY_COVERAGE,
  type Position,
  WEATHERS,
  type Weather,
  type WeatherReason,
  type WeatherResult,
  portfolioWeather,
} from './weather';
