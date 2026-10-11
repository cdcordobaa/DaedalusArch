/**
 * E1 size analysis (2026-10-10, post hoc on committed data): CSV parsing, rank correlation, the log-LOC residual, the
 * registered test procedure on a toy grid, and the committed `results/e1-grid/agg-size/size_tests.csv` reproducing
 * every registered `so5_tests.csv` row it recomputes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ols, outcomesFor, parseCsv, pearson, ranks, residualOnLogLoc, sizeCells, spearman, testOutcome } from '../../../../scripts/e1-size-analysis.js';
import type { SizeCell } from '../../../../scripts/e1-size-analysis.js';
import { ROOT } from '../u5b/score-fixture.js';

const cell = (over: Partial<SizeCell>): SizeCell => ({
  runId: 'r', arm: 'claude', model: 'm1', specLevel: 'none', taskId: 't1', runIndex: 0, valid: true, symbolic: new Map(), judge: new Map(), ...over,
});

describe('primitives', () => {
  it('parses quoted CSV cells', () => {
    expect(parseCsv('a,b\n1,"x,""y"""\n')).toEqual([{ a: '1', b: 'x,"y"' }]);
  });
  it('gives tied values their mean rank and a monotone Spearman of 1', () => {
    expect(ranks([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]);
    expect(spearman([1, 2, 3, 4], [1, 8, 27, 64])).toBeCloseTo(1, 12);
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
    expect(pearson([1, 1, 1], [2, 4, 6])).toBeUndefined();
  });
  it('fits OLS and residualises AHS on ln LOC', () => {
    expect(ols([0, 1, 2], [1, 3, 5])).toEqual({ slope: 2, intercept: 1 });
    const cells = [100, 200, 400].map((loc, i) => cell({ runId: `r${String(i)}`, loc, ahsCombined: 1 - 0.01 * Math.log(loc) }));
    for (const v of residualOnLogLoc(cells, 'ahsCombined').values()) expect(Math.abs(v)).toBeLessThan(1e-12);
  });
});

describe('sizeCells', () => {
  it('joins symbolic and judge family counts by run id suffix and marks not-run cells invalid', () => {
    const grid = [
      'requested_model_id,adapter_id,spec_level,task_id,run_index,status,ahs_deterministic,ahs_combined,ahs_neuronal,file_count,loc,violations_deterministic,violations_total,violations_per_kloc,violations_total_per_kloc,generation_ms,eval_total_ms',
      'm1,claude-code-cli,none,t1,0,accepted,0.9,0.9,1,4,200,5,6,25.000000,30.000000,10,20',
      'm1,codex-cli,none,t1,1,not-run,,,,,,,,,,,',
    ].join('\n');
    const patterns = 'run_id,code,count,weighted_count,basis\ne1-grid-000-m1_t1_none_run-0,FPAT-PATTERN,4,,symbolic\ne1-grid-000-m1_t1_none_run-0,FPAT-INTEGRITY,1,1.000000,judge\n';
    const [a, b] = sizeCells(grid, patterns);
    expect(a?.runId).toBe('e1-grid-000-m1_t1_none_run-0');
    expect(a?.symbolic.get('FPAT-PATTERN')).toBe(4);
    expect(a?.symbolic.get('FPAT-COUPLING')).toBe(0);
    expect(a?.judge.get('FPAT-INTEGRITY')).toBe(1);
    expect(a?.violationsPerKloc).toBe(25);
    expect(b?.valid).toBe(false);
    expect(b?.arm).toBe('codex');
    if (a === undefined) throw new Error('no cell');
    const excl = outcomesFor([a]).find((o) => o.name === 'violations_per_kloc_excl_fpat_pattern');
    expect(excl?.value(a)).toBe(5);
  });
});

describe('testOutcome (registered SO5 procedure)', () => {
  it('runs model, spec-level and interaction tests with Holm and pairwise rows; one model gives the spec-level test only', () => {
    const cells: SizeCell[] = [];
    let i = 0;
    for (const model of ['m1', 'm2']) for (const specLevel of ['a', 'b']) for (const run of [0, 1]) cells.push(cell({ runId: `r${String(i++)}`, model, specLevel, runIndex: run, ahsCombined: specLevel === 'a' ? 0.9 + run * 0.01 : 0.8 + run * 0.01 }));
    const o = outcomesFor(cells).find((x) => x.name === 'ahsCombined');
    if (o === undefined) throw new Error('no outcome');
    const rows = testOutcome(cells, o, { bootstrap: 1, permutation: 2 }, 200);
    expect(rows.map((r) => r[0])).toEqual(['model', 'spec-level', 'model×spec-level', 'model:m1-m2', 'spec-level:a-b']);
    expect(rows[4]?.[8]).toBe('1.000000');
    const one = testOutcome(cells.filter((c) => c.model === 'm1'), o, { bootstrap: 1, permutation: 2 }, 200);
    expect(one.map((r) => r[0])).toEqual(['spec-level', 'spec-level:a-b']);
  });
});

describe('committed agg-size output', () => {
  it('reproduces every registered so5_tests.csv row it recomputes', () => {
    const rows = parseCsv(readFileSync(join(ROOT, 'results/e1-grid/agg-size/size_tests.csv'), 'utf8'));
    const registered = rows.filter((r) => r.test_registration !== 'post-hoc');
    expect(registered.length).toBe(27);
    expect(registered.every((r) => r.reproduces_registered === 'true')).toBe(true);
  });
});
