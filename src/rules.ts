import type { Tier } from './types.ts';

export const TIERS: Tier[] = ['unproven', 'bronze', 'silver', 'gold'];
/** Lowest score for each tier above unproven. */
export const THRESHOLDS = { bronze: 30, silver: 60, gold: 80 } as const;
export const WEIGHTS = { age: 15, deliveries: 40, admission: 15, aiax: 5, acp: 25 } as const;
export const FULL_AGE_DAYS = 90;
export const FULL_VOLUME = 10; // accepted deliveries for full delivery weight
export const OUTSIDE_WEIGHT = 0.2;

/** Tier from a score. An agent with no accepted delivery is unproven whatever its score. */
export function tierFor(score: number, proven: boolean): Tier {
  if (!proven || score < THRESHOLDS.bronze) return 'unproven';
  if (score < THRESHOLDS.silver) return 'bronze';
  if (score < THRESHOLDS.gold) return 'silver';
  return 'gold';
}
export const stepOf = (t: Tier) => TIERS.indexOf(t);
/** Keeps `t` within one step of `base`. */
export function clampStep(base: Tier, t: Tier): Tier {
  const b = stepOf(base);
  return TIERS[Math.min(b + 1, Math.max(b - 1, stepOf(t)))];
}
