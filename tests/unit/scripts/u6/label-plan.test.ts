/**
 * U6: registered label-plan sizing (ADR-021 items 6 and 8; SO3-2). Hand-computed fixtures throughout.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTEXT_CUT_MARKER, LABEL_PLAN_CONFIG_FILE, LABEL_PLAN_OVER_BUDGET, V1_ONLY_STRATUM_PREFIX, available, capacityItems, capacityOf, ceilingsFor,
  checkLabelPlanConfig, escalatedBudget, p2FrameOf, p2Split, ppsInclusion, ppsSystematic, precisionStatement, sampleRegistered, stratumDrawSeed,
  thinExhaustive, trimContext, weeksNeeded,
} from '../../../../scripts/lib/label-plan.js';
import type { LabelPlanConfig } from '../../../../scripts/lib/label-plan.js';
import type { StratumSample, ViolationCandidate } from '../../../../scripts/lib/label-context.js';
import { candidateItemId } from '../../../../scripts/lib/label-context.js';
import { createRng } from '../../../../scripts/lib/stats.js';
import { CHARS_PER_TOKEN, JUDGE_TOKEN_BUDGET } from '../../../../src/llm-critic/frozen.js';
import { ROOT } from '../u5b/score-fixture.js';

function registered(): LabelPlanConfig {
  return JSON.parse(readFileSync(join(ROOT, LABEL_PLAN_CONFIG_FILE), 'utf8')) as LabelPlanConfig;
}

function vc(owner: string, functionId: string, n: number): ViolationCandidate {
  return {
    kind: 'violation', population: 'P2', projectId: owner, treeSha: 't'.repeat(40), stratumOwner: owner, sourceRoot: '/nowhere',
    key: JSON.stringify([functionId, `src/f${String(n)}.ts`, '', []]),
    fields: { functionId, functionDescription: 'd', filePath: `src/f${String(n)}.ts` },
  };
}

describe('registered config (corpus/label-plan-config.json, version 3)', () => {
  it('is valid: agy route, 300 calls, (46 + 30 + 0 + 59) x 2 + 30 = 300, P3 out of labelling, P2 PPS, audit seed 6105', () => {
    const c = registered();
    expect(checkLabelPlanConfig(c)).toEqual([]);
    expect(c.provider).toBe('agy');
    expect(c.model).toBe('gemini-3.1-pro-high');
    expect(capacityItems(c)).toBe(135);
    expect((c.sampled.P4.maxItems + c.sampled.P2.maxItems + c.sampled.P3.maxItems + c.exhaustivePlanned) * 2 + c.reaskReserveCalls).toBe(300);
    // ADR-021 item 8.1: P3 out of live labelling, its calls go to P2 (20 + 10 = 30).
    expect(c.sampled.P3.maxItems).toBe(0);
    // ADR-026 (analysis plan §10 B8): of the 30 P2 items, 6 come from the v1-only stratum set and 24 from the v2 population.
    expect(c.version).toBe(3);
    expect(c.sampled.P2).toEqual({ perStratum: 1, maxItems: 30, strataDraw: 'pps', v1OnlyMaxItems: 6 });
    // Item 8.2: whole weeks of 180 calls up to 4 weeks (720 calls); the P1 + MS basis is stated.
    expect(c.quota).toEqual({ callsPerWeek: 180, minWeeks: 2, maxWeeks: 4 });
    expect(c.exhaustivePlannedBasis).toContain('u5a-freeze-gate-a');
    // Item 8.5 and 8.6: the audit seed; the judge-unit ceiling is the judge's codeSnippet budget x 4 characters.
    expect(c.seeds).toEqual({ strata: 6101, permutation: 6103, bootstrap: 6102, audit: 6105 });
    expect(c.context.maxChars['judge-unit']).toBe(JUDGE_TOKEN_BUDGET.codeSnippet * CHARS_PER_TOKEN);
    expect(c.context.maxChars.violation).toBe(6000);
    expect(c.context.maxChars['missed-seed']).toBe(6000);
  });

  it('refuses a budget above 300 calls, sizes above the budget, a broken priority list and the item 8 fields missing', () => {
    expect(checkLabelPlanConfig({ ...registered(), budgetCalls: 400 }).join(';')).toContain('budgetCalls');
    expect(checkLabelPlanConfig({ ...registered(), exhaustivePlanned: 60 }).join(';')).toContain('need 272 calls + reserve 30 > budget 300');
    expect(checkLabelPlanConfig({ ...registered(), priority: ['P4', 'P4', 'P3'] }).join(';')).toContain('priority');
    expect(checkLabelPlanConfig({ ...registered(), version: 2 }).join(';')).toContain('version must be 3');
    expect(checkLabelPlanConfig({ ...registered(), exhaustivePlannedBasis: ' ' }).join(';')).toContain('exhaustivePlannedBasis');
    expect(checkLabelPlanConfig({ ...registered(), seeds: { strata: 1, permutation: 2, bootstrap: 3 } }).join(';')).toContain('seeds.audit');
    expect(checkLabelPlanConfig({ ...registered(), quota: { callsPerWeek: 180, minWeeks: 2, maxWeeks: 1 } }).join(';')).toContain('maxWeeks');
    expect(checkLabelPlanConfig({ ...registered(), context: { maxChars: { violation: 6000 } } }).join(';')).toContain('context.maxChars.judge-unit');
    expect(checkLabelPlanConfig({ ...registered(), sampled: { ...registered().sampled, P2: { perStratum: 1, maxItems: 30, strataDraw: 'x' } } }).join(';')).toContain('strataDraw');
    // ADR-026: the v1-only size is required on P2, at most P2's ceiling, and a P2 field only.
    const sampled = registered().sampled;
    expect(checkLabelPlanConfig({ ...registered(), sampled: { ...sampled, P2: { perStratum: 1, maxItems: 30, strataDraw: 'pps' } } }).join(';')).toContain('sampled.P2.v1OnlyMaxItems');
    expect(checkLabelPlanConfig({ ...registered(), sampled: { ...sampled, P2: { ...sampled.P2, v1OnlyMaxItems: 31 } } }).join(';')).toContain('sampled.P2.v1OnlyMaxItems');
    expect(checkLabelPlanConfig({ ...registered(), sampled: { ...sampled, P4: { ...sampled.P4, v1OnlyMaxItems: 1 } } }).join(';')).toContain('sampled.P4.v1OnlyMaxItems is a P2 field only');
    expect(checkLabelPlanConfig(null)).toEqual(['config is not an object']);
  });
});

describe('ceilings under the budget (priority P4 > P2 > P3) and the escalation rule (item 8.2)', () => {
  const sizes = { P4: Array<number>(46).fill(1), P2: Array<number>(30).fill(4), P3: Array<number>(15).fill(2) };
  // The v1-only P2 set: 10 strata of 2, so P2 wants 24 (v2) + 6 (v1-only) = 30 and the sampled total stays 76.
  const v1 = Array<number>(10).fill(2);

  it('P1 + MS within 135: no escalation; lowers P3 (0), then P2, then P4 until 135 items fit', () => {
    // exhaustive 100; P4 46, P2 30, P3 0 (registered) -> 176, 41 over: P2 -30, P4 -11.
    const c = ceilingsFor(registered(), 100, sizes, v1);
    expect(c).toMatchObject({ ok: true, budgetCalls: 300, escalated: false, capacityItems: 135, exhaustiveKept: 100 });
    expect(c.maxItems).toEqual({ P4: 35, P2: 0, P3: 0 });
    expect(c.p2Split).toEqual({ v2: 0, v1Only: 0 });
    expect(c.lowered).toEqual(['P2', 'P4']);
  });

  it('keeps the registered ceilings when everything fits, and caps them by what the strata can give', () => {
    const c = ceilingsFor(registered(), 10, { P4: [1, 1, 1], P2: Array<number>(30).fill(4), P3: [5] }, v1);
    expect(c.maxItems).toEqual({ P4: 3, P2: 30, P3: 0 });
    expect(c.p2Split).toEqual({ v2: 24, v1Only: 6 });
    expect(c.lowered).toEqual([]);
    // Without a v1-only set the v2 population still gets only its registered 24 (no reallocation, ADR-026).
    expect(ceilingsFor(registered(), 10, { P4: [1, 1, 1], P2: Array<number>(30).fill(4), P3: [5] }).maxItems.P2).toBe(24);
  });

  it('P1 + MS = 136 > 135: whole weeks, 360 (165 items) too small for 136 + 76, 540 (255 items) holds them, nothing lowered', () => {
    expect(capacityOf(registered(), 360)).toBe(165);
    expect(capacityOf(registered(), 540)).toBe(255);
    expect(escalatedBudget(registered(), 136, 76)).toEqual({ budgetCalls: 540, escalated: true });
    const c = ceilingsFor(registered(), 136, sizes, v1);
    expect(c).toMatchObject({ ok: true, budgetCalls: 540, escalated: true, capacityItems: 255, exhaustiveKept: 136, lowered: [] });
    expect(c.maxItems).toEqual({ P4: 46, P2: 30, P3: 0 });
  });

  it('P1 + MS = 300: the limit of 4 weeks (720 calls, 345 items), then P2 -30 and P4 -1; = 400: thinned, never refused', () => {
    expect(escalatedBudget(registered(), 200, 76)).toEqual({ budgetCalls: 720, escalated: true });
    const c = ceilingsFor(registered(), 300, sizes, v1);
    expect(c).toMatchObject({ budgetCalls: 720, capacityItems: 345, exhaustiveKept: 300 });
    expect(c.maxItems).toEqual({ P4: 45, P2: 0, P3: 0 });
    const over = ceilingsFor(registered(), 400, sizes, v1);
    expect(over).toMatchObject({ ok: true, budgetCalls: 720, exhaustiveKept: 345, maxItems: { P4: 0, P2: 0, P3: 0 } });
    expect(over.detail).toContain(LABEL_PLAN_OVER_BUDGET);
    expect(over.detail).toContain('p = 345/400');
  });

  it('thinning past the limit: one seeded SRS over all exhaustive items, p = keep / total (2 of 5 -> 0.4)', () => {
    const cands = [vc('A', 'F', 0), vc('A', 'F', 1), vc('A', 'F', 2), vc('B', 'F', 0), vc('B', 'F', 1)];
    const samples: StratumSample<ViolationCandidate>[] = [
      { population: 'P1', stratum: 'A, F', size: 3, cap: null, sampled: cands.slice(0, 3).map((c) => ({ candidate: c, itemId: candidateItemId(c), inclusionProbability: 1 })) },
      { population: 'P1', stratum: 'B, F', size: 2, cap: null, sampled: cands.slice(3).map((c) => ({ candidate: c, itemId: candidateItemId(c), inclusionProbability: 1 })) },
    ];
    const t = thinExhaustive(samples, 2, 6101);
    const kept = t.flatMap((s) => s.sampled);
    expect(kept).toHaveLength(2);
    expect(kept.every((i) => i.inclusionProbability === 0.4)).toBe(true);
    expect(t.map((s) => s.size)).toEqual([3, 2]);
    expect(thinExhaustive(samples, 2, 6101)).toEqual(t);
    expect(thinExhaustive(samples, 5, 6101)).toEqual(samples);
  });

  it('available sums min(perStratum, N_h)', () => {
    expect(available([3, 1, 2, 5], 2)).toBe(7);
    expect(available([3, 1, 2, 5], 1)).toBe(4);
  });
});

describe('two-stage sampling with inclusion probabilities', () => {
  // Strata A (3 items), B (1), C (2), D (5).
  const cands = [
    ...[0, 1, 2].map((i) => vc('A', 'FF-S01', i)), vc('B', 'FF-S01', 0), ...[0, 1].map((i) => vc('C', 'FF-S01', i)),
    ...[0, 1, 2, 3, 4].map((i) => vc('D', 'FF-S01', i)),
  ];

  it('all strata fit: p = min(perStratum, N_h) / N_h (A 2/3, B 1, C 1, D 2/5)', () => {
    const s = sampleRegistered(cands, 'P2', { perStratum: 2, maxItems: 10 }, 10, 6101, () => 7101);
    const p = new Map(s.map((x) => [x.stratum, x.sampled.map((i) => i.inclusionProbability)]));
    expect(p.get('A, FF-S01')).toEqual([2 / 3, 2 / 3]);
    expect(p.get('B, FF-S01')).toEqual([1]);
    expect(p.get('C, FF-S01')).toEqual([1, 1]);
    expect(p.get('D, FF-S01')).toEqual([0.4, 0.4]);
    expect(s.every((x) => x.stratumInclusionProbability === 1)).toBe(true);
    expect(s.map((x) => x.size)).toEqual([3, 1, 2, 5]);
  });

  it('SRS, too many strata: m = floor(2 / 1) = 2 of M = 4 strata, p = (2/4) x 1/N_h; deterministic for the seeds', () => {
    const s = sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 2 }, 2, 6101, () => 7101);
    const kept = s.filter((x) => x.sampled.length > 0);
    expect(kept).toHaveLength(2);
    const n = new Map([['A, FF-S01', 3], ['B, FF-S01', 1], ['C, FF-S01', 2], ['D, FF-S01', 5]]);
    for (const k of kept) expect(k.sampled[0]?.inclusionProbability).toBeCloseTo(0.5 / (n.get(k.stratum) ?? 0), 12);
    expect(s.every((x) => x.stratumInclusionProbability === 0.5)).toBe(true);
    expect(s).toHaveLength(4);
    expect(sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 2 }, 2, 6101, () => 7101)).toEqual(s);
    for (const k of kept) expect(cands.map(candidateItemId)).toContain(k.sampled[0]?.itemId);
  });

  it('a ceiling of 0 draws no stratum; other populations are ignored', () => {
    const s = sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 0 }, 0, 6101, () => 7101);
    expect(s.flatMap((x) => x.sampled)).toEqual([]);
    expect(sampleRegistered(cands, 'P3', { perStratum: 1, maxItems: 5 }, 5, 6101, () => 7101)).toEqual([]);
  });
});

describe('PPS stratum draw (ADR-021 item 8.3: P2 self-weighting)', () => {
  // Sizes A 1, B 2, C 3, D 14 (N = 20), m = 2: D has 2 x 14 / 20 = 1.4 >= 1 -> certain; then m' = 1 over N' = 6:
  // A 1/6, B 2/6, C 3/6. With one item per stratum every non-certain item has p = pi_h / N_h = 1/6.
  const sizes = new Map([['A', 1], ['B', 2], ['C', 3], ['D', 14]]);

  it('inclusion probabilities by hand: A 1/6, B 1/3, C 1/2, D 1 (certain); they sum to m = 2', () => {
    const pi = ppsInclusion(sizes, 2);
    expect(pi.get('A')).toBeCloseTo(1 / 6, 12);
    expect(pi.get('B')).toBeCloseTo(1 / 3, 12);
    expect(pi.get('C')).toBeCloseTo(1 / 2, 12);
    expect(pi.get('D')).toBe(1);
    expect([...pi.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(2, 12);
    expect([...ppsInclusion(sizes, 4).values()]).toEqual([1, 1, 1, 1]);
  });

  it('systematic selection keeps exactly m strata, the certainty stratum always; frequencies follow pi (2 000 seeds)', () => {
    const pi = ppsInclusion(sizes, 2);
    const freq = new Map<string, number>();
    for (let seed = 1; seed <= 2000; seed += 1) {
      const kept = ppsSystematic(pi, createRng(seed));
      expect(kept.size).toBe(2);
      expect(kept.has('D')).toBe(true);
      for (const k of kept) freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    expect((freq.get('A') ?? 0) / 2000).toBeCloseTo(1 / 6, 1);
    expect((freq.get('B') ?? 0) / 2000).toBeCloseTo(1 / 3, 1);
    expect((freq.get('C') ?? 0) / 2000).toBeCloseTo(1 / 2, 1);
  });

  it('sampleRegistered with strataDraw pps: kept items of non-certain strata all have p = 1/6; D items 1/14', () => {
    const cands = [
      vc('A', 'F', 0), ...[0, 1].map((i) => vc('B', 'F', i)), ...[0, 1, 2].map((i) => vc('C', 'F', i)),
      ...Array.from({ length: 14 }, (_, i) => vc('D', 'F', i)),
    ];
    const s = sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 2, strataDraw: 'pps' }, 2, 6101, () => 7101);
    const kept = s.filter((x) => x.sampled.length > 0);
    expect(kept).toHaveLength(2);
    for (const k of kept) {
      expect(k.sampled[0]?.inclusionProbability).toBeCloseTo(k.stratum === 'D, F' ? 1 / 14 : 1 / 6, 12);
    }
    expect(new Map(s.map((x) => [x.stratum, x.stratumInclusionProbability])).get('C, F')).toBeCloseTo(0.5, 12);
  });
});

describe('P2 frames: v2 population and v1-only stratum set (ADR-026; analysis plan §10 B8)', () => {
  const many = Array<number>(40).fill(3);

  it('registered split 24 / 6, each capped by what its own strata give, a short frame not refilled', () => {
    expect(p2Split(registered(), Number.POSITIVE_INFINITY, many, Array<number>(10).fill(2))).toEqual({ v2: 24, v1Only: 6, total: 30 });
    // Two v1-only strata of one item: 2 items, the 4 unused slots stay unused.
    expect(p2Split(registered(), Number.POSITIVE_INFINITY, many, [1, 1])).toEqual({ v2: 24, v1Only: 2, total: 26 });
    // Three v2 strata: 3 items; v1-only keeps its 6.
    expect(p2Split(registered(), Number.POSITIVE_INFINITY, [5, 5, 5], Array<number>(10).fill(2))).toEqual({ v2: 3, v1Only: 6, total: 9 });
    expect(p2Split(registered(), Number.POSITIVE_INFINITY, [], [])).toEqual({ v2: 0, v1Only: 0, total: 0 });
  });

  it('lowered by the budget: v1-only floor(L x 6 / 30), v2 the rest; a share one frame cannot use goes to the other', () => {
    // L = 10: v1-only floor(60 / 30) = 2, v2 8.
    expect(p2Split(registered(), 10, many, Array<number>(10).fill(2))).toEqual({ v2: 8, v1Only: 2, total: 10 });
    // L = 4: v1-only floor(24 / 30) = 0, v2 4.
    expect(p2Split(registered(), 4, many, Array<number>(10).fill(2))).toEqual({ v2: 4, v1Only: 0, total: 4 });
    // L = 10 with one v1-only stratum: v1-only 1, v2 9.
    expect(p2Split(registered(), 10, many, [3])).toEqual({ v2: 9, v1Only: 1, total: 10 });
    // L = 5 with three v2 strata: v1-only floor(30 / 30) = 1, v2 min(3, 4) = 3, then v1-only min(6, 5 - 3) = 2.
    expect(p2Split(registered(), 5, [5, 5, 5], Array<number>(10).fill(2))).toEqual({ v2: 3, v1Only: 2, total: 5 });
  });

  it('frame of a stratum name; the v1-only frame has its own stratum-draw stream, the v2 stream is unchanged', () => {
    expect(p2FrameOf('proj, FF-CV05')).toBe('v2');
    expect(p2FrameOf(`${V1_ONLY_STRATUM_PREFIX}proj, FF-CV05`)).toBe('v1-only');
    expect(stratumDrawSeed(6101, 'P2', 'v1-only')).not.toBe(stratumDrawSeed(6101, 'P2'));
    expect(stratumDrawSeed(6101, 'P2', undefined)).toBe(stratumDrawSeed(6101, 'P2'));
  });

  it('PPS on the v1-only set by hand: X 2, Y 2 (N = 4), m = 1 -> pi 1/2 each, p = 1/2 x 1/2 = 1/4', () => {
    const cands = [vc(`${V1_ONLY_STRATUM_PREFIX}A`, 'FF-CV05', 0), vc(`${V1_ONLY_STRATUM_PREFIX}A`, 'FF-CV05', 1), vc(`${V1_ONLY_STRATUM_PREFIX}A`, 'FF-C02', 2), vc(`${V1_ONLY_STRATUM_PREFIX}A`, 'FF-C02', 3)];
    const s = sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 1, strataDraw: 'pps' }, 1, 6101, () => 7101, 'v1-only');
    expect(s.map((x) => [x.stratum, x.size, x.stratumInclusionProbability])).toEqual([
      ['v1-only: A, FF-C02', 2, 0.5], ['v1-only: A, FF-CV05', 2, 0.5],
    ]);
    const kept = s.flatMap((x) => x.sampled);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.inclusionProbability).toBe(0.25);
  });

  it('precision statements: v1-only counts only even at n_eff >= 10', () => {
    const r = precisionStatement('v1-only', Array<number>(12).fill(1), true);
    expect(r).toEqual({ row: 'v1-only', n: 12, nEff: 12, halfWidthAt50: null, halfWidthAt85: null });
  });
});

describe('context ceiling and precision statements', () => {
  it('cuts a long context at a line break and marks the cut; a short one is unchanged', () => {
    const ctx = Array.from({ length: 20 }, (_, i) => `line ${String(i).padStart(2, '0')}`).join('\n');
    const t = trimContext(ctx, 120);
    expect(t.cut).toBe(true);
    expect(t.text.length).toBeLessThanOrEqual(120);
    expect(t.text.endsWith(CONTEXT_CUT_MARKER)).toBe(true);
    const head = t.text.slice(0, t.text.length - CONTEXT_CUT_MARKER.length - 1);
    expect(ctx.startsWith(`${head}\n`)).toBe(true);
    expect(trimContext('short', 120)).toEqual({ text: 'short', cut: false });
  });

  it('Kish effective n and the Wilson half-width at it (hand-computed)', () => {
    // E1 headline at nominal n = 36 with equal weights: n_eff = 36; half-width 0.155257 at 0.5, 0.115897 at 0.85.
    const e1 = precisionStatement('E1', Array<number>(36).fill(1));
    expect(e1.nEff).toBeCloseTo(36, 12);
    expect(e1.halfWidthAt50).toBeCloseTo(0.155257, 6);
    expect(e1.halfWidthAt85).toBeCloseTo(0.115897, 6);
    // 10 weights of 1 and 10 of 3: (40)^2 / (10 + 90) = 16; half-width at 16 = 0.220004.
    const mixed = precisionStatement('mixed', [...Array<number>(10).fill(1), ...Array<number>(10).fill(3)]);
    expect(mixed).toMatchObject({ n: 20, nEff: 16 });
    expect(mixed.halfWidthAt50).toBeCloseTo(0.220004, 6);
    // Nine weights of 1 and one of 100: n_eff = 109^2 / 10009 = 1.187 < 10 -> counts only.
    const skew = precisionStatement('skew', [...Array<number>(9).fill(1), 100]);
    expect(skew.nEff).toBeCloseTo((109 * 109) / 10009, 12);
    expect(skew.halfWidthAt50).toBeNull();
    expect(precisionStatement('none', [])).toEqual({ row: 'none', n: 0, nEff: 0, halfWidthAt50: null, halfWidthAt85: null });
  });

  it('weeks of quota: max(2, ceil(calls / 180))', () => {
    expect(weeksNeeded(registered(), 300)).toBe(2);
    expect(weeksNeeded(registered(), 100)).toBe(2);
    expect(weeksNeeded(registered(), 361)).toBe(3);
  });
});
