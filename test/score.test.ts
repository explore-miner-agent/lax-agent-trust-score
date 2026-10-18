import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAgent, tierFor, clampStep, type AgentRecord } from '../src/index.ts';

const base: AgentRecord = { listedAt: '2026-07-20T00:00:00Z', asOf: '2026-10-18T00:00:00Z', accepted: 0, rejected: 0, admission: 'none', aiaxReady: false, acpScore: 0 };
const rec = (o: Partial<AgentRecord>) => ({ ...base, ...o });

test('tier boundaries (table)', () => {
  const table: [number, boolean, string][] = [
    [0, true, 'unproven'], [29, true, 'unproven'], [30, true, 'bronze'], [59, true, 'bronze'],
    [60, true, 'silver'], [79, true, 'silver'], [80, true, 'gold'], [100, true, 'gold'],
    [100, false, 'unproven'], [80, false, 'unproven'], [30, false, 'unproven'],
  ];
  for (const [s, p, t] of table) assert.equal(tierFor(s, p), t, `score ${s} proven ${p}`);
});

// Records built to land on each side of each boundary. Age 90 days = 15; one accepted delivery = 40*(2/3)*0.1 = 2.667;
// ten accepted = 40*(11/12) = 36.667; admission passed = 15; AIAX = 5; ACP n = n/4.
test('scoreAgent lands on every boundary (table)', () => {
  const table: [Partial<AgentRecord>, number, string][] = [
    [{ accepted: 1, acpScore: 45 }, 29, 'unproven'], // 28.9
    [{ accepted: 1, acpScore: 50 }, 30, 'bronze'], // 30.2
    [{ accepted: 1, admission: 'passed', aiaxReady: true, acpScore: 85 }, 59, 'bronze'], // 58.9
    [{ accepted: 1, admission: 'passed', aiaxReady: true, acpScore: 90 }, 60, 'silver'], // 60.2
    [{ accepted: 10, admission: 'passed', acpScore: 50 }, 79, 'silver'], // 79.2
    [{ accepted: 10, admission: 'passed', acpScore: 54 }, 80, 'gold'], // 80.2
    [{ accepted: 10, admission: 'passed', aiaxReady: true, acpScore: 100 }, 97, 'gold'], // 96.7
  ];
  for (const [o, score, tier] of table) {
    const r = scoreAgent(rec(o));
    assert.deepEqual([r.score, r.tier], [score, tier], JSON.stringify(o));
  }
});

test('an unproven agent is never refused, even with a perfect record otherwise', () => {
  const r = scoreAgent(rec({ admission: 'passed', aiaxReady: true, acpScore: 100 }));
  assert.equal(r.tier, 'unproven');
  assert.equal(r.score, 60);
  assert.ok(r.reasons.some((x) => x.includes('not refused')));
  const worst = scoreAgent(rec({ listedAt: base.asOf, accepted: 0, rejected: 50, admission: 'failed', acpScore: -5 }));
  assert.equal(worst.tier, 'unproven');
  assert.equal(worst.score, 0);
});

test('outside score moves the tier at most one step', () => {
  const low = rec({ accepted: 1, acpScore: 50 }); // own 30, bronze
  assert.equal(scoreAgent(low).tier, 'bronze');
  const up = scoreAgent(low, { source: 'x', score: 100 }); // 0.8*30.17+20 = 44 bronze
  assert.equal(up.tier, 'bronze');
  const gold = rec({ accepted: 10, admission: 'passed', aiaxReady: true, acpScore: 100 }); // 15+36.67+15+5+25 = 96.7
  const down = scoreAgent(gold, { source: 'x', score: 0 }); // 77 -> silver (one step)
  assert.equal(down.tier, 'silver');
  // own gold, outside would need to drop it two steps: clamped
  const g2 = rec({ accepted: 10, admission: 'passed', acpScore: 54 }); // own 80.17 gold
  const r = scoreAgent(g2, { source: 'x', score: -100 }); // 0.8*80.17 = 64 silver: one step, fine
  assert.equal(r.tier, 'silver');
  // own unproven (no deliveries): outside 100 can lift by one step only
  const u = scoreAgent(rec({ admission: 'passed', aiaxReady: true, acpScore: 100 }), { source: 'x', score: 100 }); // 0.8*60+20 = 68 silver wanted
  assert.equal(u.tier, 'bronze');
  assert.ok(u.reasons.some((x) => x.includes('held to one step')));
});

test('clampStep never moves more than one step', () => {
  const T = ['unproven', 'bronze', 'silver', 'gold'] as const;
  for (const a of T) for (const b of T) {
    const c = clampStep(a, b);
    assert.ok(Math.abs(T.indexOf(c) - T.indexOf(a)) <= 1);
    if (Math.abs(T.indexOf(b) - T.indexOf(a)) <= 1) assert.equal(c, b);
  }
});

test('deterministic, with reasons for every component', () => {
  const r1 = scoreAgent(rec({ accepted: 3, rejected: 1, acpScore: 70 }));
  const r2 = scoreAgent(rec({ accepted: 3, rejected: 1, acpScore: 70 }));
  assert.deepEqual(r1, r2);
  assert.equal(r1.reasons.length, 6);
});

test('bad inputs degrade to zero, never throw', () => {
  const r = scoreAgent(rec({ listedAt: 'garbage', accepted: -3 as any, rejected: 1.5 as any, acpScore: NaN }), { source: 'x', score: NaN });
  assert.equal(r.tier, 'unproven');
  assert.equal(Number.isFinite(r.score), true);
});
