/**
 * U6 Labels: registered label-plan sizing (ADR-021 item 6; SO3-2). Hand-computed fixtures throughout.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTEXT_CUT_MARKER, LABEL_PLAN_CONFIG_FILE, LABEL_PLAN_OVER_BUDGET, available, capacityItems, ceilingsFor, checkLabelPlanConfig,
  precisionStatement, sampleRegistered, trimContext, weeksNeeded,
} from '../../../../scripts/lib/label-plan.js';
import type { LabelPlanConfig } from '../../../../scripts/lib/label-plan.js';
import type { ViolationCandidate } from '../../../../scripts/lib/label-context.js';
import { candidateItemId } from '../../../../scripts/lib/label-context.js';
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

describe('registered config (corpus/label-plan-config.json)', () => {
  it('the committed config is valid: agy route, 300 calls, (46 + 20 + 10 + 59) x 2 + 30 = 300', () => {
    const c = registered();
    expect(checkLabelPlanConfig(c)).toEqual([]);
    expect(c.provider).toBe('agy');
    expect(c.model).toBe('gemini-3.1-pro-high');
    expect(capacityItems(c)).toBe(135);
    expect((c.sampled.P4.maxItems + c.sampled.P2.maxItems + c.sampled.P3.maxItems + c.exhaustivePlanned) * 2 + c.reaskReserveCalls).toBe(300);
  });

  it('refuses a budget above 300 calls, sizes above the budget and a broken priority list', () => {
    expect(checkLabelPlanConfig({ ...registered(), budgetCalls: 400 }).join(';')).toContain('budgetCalls');
    expect(checkLabelPlanConfig({ ...registered(), exhaustivePlanned: 60 }).join(';')).toContain('need 272 calls + reserve 30 > budget 300');
    expect(checkLabelPlanConfig({ ...registered(), priority: ['P4', 'P4', 'P3'] }).join(';')).toContain('priority');
    expect(checkLabelPlanConfig(null)).toEqual(['config is not an object']);
  });
});

describe('ceilings under the budget (priority P4 > P2 > P3)', () => {
  it('lowers P3, then P2, then P4 until P1 + MS + sampled fit 135 items', () => {
    // exhaustive 100; P4 46 strata of 1, P2 30 strata, P3 15 strata: 100 + 46 + 20 + 10 = 176, 41 over.
    const sizes = { P4: Array<number>(46).fill(1), P2: Array<number>(30).fill(4), P3: Array<number>(15).fill(2) };
    const c = ceilingsFor(registered(), 100, sizes);
    expect(c.ok).toBe(true);
    expect(c.maxItems).toEqual({ P4: 35, P2: 0, P3: 0 });
    expect(c.lowered).toEqual(['P3', 'P2', 'P4']);
  });

  it('keeps the registered ceilings when everything fits, and caps them by what the strata can give', () => {
    const c = ceilingsFor(registered(), 10, { P4: [1, 1, 1], P2: Array<number>(30).fill(4), P3: [5] });
    expect(c.maxItems).toEqual({ P4: 3, P2: 20, P3: 1 });
    expect(c.lowered).toEqual([]);
  });

  it('refuses when P1 + MS alone exceed the capacity (a reported limitation, ADR-021 item 7)', () => {
    const c = ceilingsFor(registered(), 136, { P4: [], P2: [], P3: [] });
    expect(c.ok).toBe(false);
    expect(c.detail).toContain(LABEL_PLAN_OVER_BUDGET);
    expect(c.detail).toContain('272 calls > 270');
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

  it('too many strata: m = floor(2 / 1) = 2 of M = 4 strata, p = (2/4) x 1/N_h; deterministic for the seeds', () => {
    const s = sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 2 }, 2, 6101, () => 7101);
    const kept = s.filter((x) => x.sampled.length > 0);
    expect(kept).toHaveLength(2);
    const n = new Map([['A, FF-S01', 3], ['B, FF-S01', 1], ['C, FF-S01', 2], ['D, FF-S01', 5]]);
    for (const k of kept) expect(k.sampled[0]?.inclusionProbability).toBeCloseTo(0.5 / (n.get(k.stratum) ?? 0), 12);
    expect(s.every((x) => x.stratumInclusionProbability === 0.5)).toBe(true);
    // Not-drawn strata keep their sizes in the plan.
    expect(s).toHaveLength(4);
    expect(sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 2 }, 2, 6101, () => 7101)).toEqual(s);
    // The item ids are the candidates' own (BR-U5b-36).
    for (const k of kept) expect(cands.map(candidateItemId)).toContain(k.sampled[0]?.itemId);
  });

  it('a ceiling of 0 draws no stratum; other populations are ignored', () => {
    const s = sampleRegistered(cands, 'P2', { perStratum: 1, maxItems: 0 }, 0, 6101, () => 7101);
    expect(s.flatMap((x) => x.sampled)).toEqual([]);
    expect(sampleRegistered(cands, 'P3', { perStratum: 1, maxItems: 5 }, 5, 6101, () => 7101)).toEqual([]);
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

  it('Wilson half-widths at nominal n (hand-computed): n = 46 gives 0.13881 at p = 0.5 and 0.10274 at p = 0.85', () => {
    const s = precisionStatement('P4', 46);
    expect(s.halfWidthAt50).toBeCloseTo(0.13881, 5);
    expect(s.halfWidthAt85).toBeCloseTo(0.10274, 5);
    expect(precisionStatement('P2', 20).halfWidthAt50).toBeCloseTo(0.20070, 5);
    expect(precisionStatement('MS', 9)).toEqual({ population: 'MS', n: 9, halfWidthAt50: null, halfWidthAt85: null });
  });

  it('weeks of quota: max(2, ceil(calls / 180))', () => {
    expect(weeksNeeded(registered(), 300)).toBe(2);
    expect(weeksNeeded(registered(), 100)).toBe(2);
    expect(weeksNeeded(registered(), 361)).toBe(3);
  });
});
