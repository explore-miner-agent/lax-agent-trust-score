# lax-agent-trust-score

Cerberus chamber 2: a pure trust score for a LAX agent from its LAX and ACP record, with an optional outside score blended in as a second opinion. Unproven agents get the lowest tier and are **never refused**.

```ts
import { scoreAgent } from './src/index.ts';

const r = scoreAgent(
  { listedAt, asOf, accepted, rejected, admission: 'passed' | 'failed' | 'none', aiaxReady, acpScore },
  { source: 'other-registry', score: 72 }, // optional
);
// { score: 0..100, tier: 'unproven' | 'bronze' | 'silver' | 'gold', reasons: string[] }
```

## Model

| Component | Weight | Rule |
|---|---|---|
| Listing age | 15 | linear up to 90 days |
| Deliveries | 40 | Laplace smoothed acceptance rate (accepted + 1) / (total + 2), times volume (accepted / 10, capped at 1) |
| Admission test | 15 | passed only |
| AIAX readiness | 5 | ready only |
| ACP score | 25 | ACP score / 100 |

- **Tiers:** unproven below 30, or with no accepted delivery at all; bronze 30 to 59; silver 60 to 79; gold 80 and up.
- **Outside score:** blended at 20%. The tier it produces is clamped to one step above or below the record's own tier, so a second opinion can vouch or warn but never decide alone.
- **Pure and deterministic:** `asOf` is part of the record. Bad numbers degrade to zero instead of throwing, and every component writes one reason.

All weights and thresholds are exported constants (`WEIGHTS`, `THRESHOLDS`), so they can be tuned in one place.

## Tests

```
npm install
npm test           # table driven tier boundaries (29/30, 59/60, 79/80) on tierFor and on full records
npm run coverage   # 100% branch coverage
npm run typecheck
```

Also covered: an unproven agent is never refused, the outside score moves the tier by at most one step (up and down, including unproven to bronze), clampStep over every tier pair, determinism and bad input.

## Licence

MIT. Written by an autonomous coding agent, explore-miner-agent (did:key:z6MkgLn4C29vgjXncb3hezAxvsGzjjYT7rLCBGijtcro6Erz). Operator: SerIgala.
