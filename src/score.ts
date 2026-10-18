import { clampStep, FULL_AGE_DAYS, FULL_VOLUME, OUTSIDE_WEIGHT, tierFor, WEIGHTS } from './rules.ts';
import type { AgentRecord, OutsideScore, TrustResult } from './types.ts';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const nonNegInt = (n: number) => (Number.isInteger(n) && n >= 0 ? n : 0);

/** The record's own score before any outside opinion, 0 to 100 (not rounded). */
export function ownScore(r: AgentRecord): { raw: number; reasons: string[] } {
  const reasons: string[] = [];
  const days = Math.max(0, (Date.parse(r.asOf) - Date.parse(r.listedAt)) / 86_400_000) || 0;
  const age = WEIGHTS.age * clamp01(days / FULL_AGE_DAYS);
  reasons.push(`listing age ${Math.floor(days)} days: ${age.toFixed(1)} of ${WEIGHTS.age}`);
  const acc = nonNegInt(r.accepted), rej = nonNegInt(r.rejected);
  // Laplace smoothed acceptance rate, scaled by volume so one lucky delivery is not a track record.
  const rate = (acc + 1) / (acc + rej + 2);
  const deliveries = WEIGHTS.deliveries * rate * clamp01(acc / FULL_VOLUME);
  reasons.push(`${acc} accepted, ${rej} rejected deliveries: ${deliveries.toFixed(1)} of ${WEIGHTS.deliveries}`);
  const adm = r.admission === 'passed' ? WEIGHTS.admission : 0;
  reasons.push(`admission test ${r.admission}: ${adm} of ${WEIGHTS.admission}`);
  const aiax = r.aiaxReady ? WEIGHTS.aiax : 0;
  reasons.push(`AIAX ${r.aiaxReady ? 'ready' : 'not ready'}: ${aiax} of ${WEIGHTS.aiax}`);
  const acp = WEIGHTS.acp * clamp01((Number.isFinite(r.acpScore) ? r.acpScore : 0) / 100);
  reasons.push(`ACP score ${Number.isFinite(r.acpScore) ? r.acpScore : 0}: ${acp.toFixed(1)} of ${WEIGHTS.acp}`);
  return { raw: age + deliveries + adm + aiax + acp, reasons };
}

/**
 * Scores an agent 0 to 100 and assigns a tier. Never refuses: the weakest result is the `unproven` tier.
 * An outside score is blended at 20% and can move the tier by at most one step from the record's own tier.
 */
export function scoreAgent(record: AgentRecord, outside?: OutsideScore): TrustResult {
  const { raw, reasons } = ownScore(record);
  const proven = nonNegInt(record.accepted) > 0;
  if (!proven) reasons.push('no accepted delivery yet: unproven tier, not refused');
  const own = Math.round(raw);
  const ownTier = tierFor(own, proven);
  if (!outside || !Number.isFinite(outside.score)) {
    reasons.push(`score ${own}: tier ${ownTier}`);
    return { score: own, tier: ownTier, reasons };
  }
  const o = Math.min(100, Math.max(0, outside.score));
  const blended = Math.round((1 - OUTSIDE_WEIGHT) * raw + OUTSIDE_WEIGHT * o);
  // The outside opinion may vouch for an unproven agent by one step, never more.
  const wanted = tierFor(blended, true);
  const tier = clampStep(ownTier, wanted);
  reasons.push(`outside score ${o} from ${outside.source} blended at ${OUTSIDE_WEIGHT * 100}%: ${blended}`);
  if (tier !== wanted) reasons.push(`outside score would give ${wanted}; held to one step from ${ownTier}`);
  reasons.push(`score ${blended}: tier ${tier}`);
  return { score: blended, tier, reasons };
}
