/**
 * ADR-021 SO4-06 (precision and F1 intervals) and SO4-05 (seed coverage, golden N against the floor), hand-computed.
 *
 * Wilson values: z = 1.959963984540054, Wilson(p, n) = (p + z²/2n ± z·sqrt(p(1−p)/n + z²/4n²)) / (1 + z²/n);
 * Clopper–Pearson at k = n: lower bound (α/2)^(1/n).
 */
import {
  f1OfSums, precisionF1Intervals,
} from '../../../../scripts/lib/stats.js';
import type { ConfusionCell } from '../../../../scripts/lib/stats.js';
import {
  floorStatement, GOLDEN_CEILING, GOLDEN_FLOOR, GOLDEN_N_COLUMNS, goldenNRows, isGoldenInstance, SEED_COVERAGE_COLUMNS, seedCoverageRows,
} from '../../../../scripts/lib/so4-coverage.js';
import type { CoverageInput } from '../../../../scripts/lib/so4-coverage.js';
import { K_TARGET_MAX, K_TARGET_MIN } from '../../../../scripts/lib/mutation/freeze-gates.js';

const r6 = (x: number | null): string | null => (x === null ? null : x.toFixed(6));
const cell = (project: string, operator: string, tp: number, fp: number, fn: number): ConfusionCell => ({ project, operator, tp, fp, fn });

describe('f1OfSums (ADR-021 SO4-06)', () => {
  it('pools the cells: 2TP / (2TP + FP + FN); undefined (NaN) when precision or recall is undefined', () => {
    expect(r6(f1OfSums([{ tp: 1, fp: 1, fn: 0 }, { tp: 2, fp: 0, fn: 2 }]))).toBe('0.666667'); // 6 / (6 + 1 + 2)
    expect(f1OfSums([{ tp: 0, fp: 0, fn: 3 }])).toBeNaN();
    expect(f1OfSums([{ tp: 0, fp: 2, fn: 0 }])).toBeNaN();
    expect(f1OfSums([{ tp: 0, fp: 1, fn: 1 }])).toBe(0);
  });
});

describe('precisionF1Intervals (ADR-021 SO4-06; ADR-020 item 3 unit rule)', () => {
  // 4 cells on 2 projects: TP 12, FP 3, FN 8.
  const four = [cell('p1', 'MO-A', 4, 1, 1), cell('p1', 'MO-B', 3, 0, 2), cell('p2', 'MO-A', 3, 1, 3), cell('p2', 'MO-B', 2, 1, 2)];

  it('fewer than 10 cells: Wilson on the pooled precision with n = cells; Wilson on the violations as the "if independent" bound', () => {
    const r = precisionF1Intervals(four, { seed: 1, resamples: 200 });
    expect([r.tp, r.fp, r.fn, r.nPrecisionCells, r.nF1Cells, r.nProjects]).toEqual([12, 3, 8, 4, 4, 2]);
    expect(r6(r.precision.estimate)).toBe('0.800000');
    // Wilson(p = 0.8, n = 4) = [0.336834, 0.969232]; Wilson(12, 15) = [0.548146, 0.929525].
    expect([r6(r.precision.cell.ciLow), r6(r.precision.cell.ciHigh), r.precision.cell.ciMethod]).toEqual(['0.336834', '0.969232', 'wilson-cells']);
    expect([r6(r.precision.independent.ciLow), r6(r.precision.independent.ciHigh), r.precision.independent.ciMethod]).toEqual(['0.548146', '0.929525', 'wilson']);
    expect(r.precision.project.ciMethod).toBe('cluster-bootstrap');
    expect(r.precision.project.descriptive).toBe(true); // 2 < 10 projects
  });

  it('F1: 24/35 = 0.685714; no cell interval below 10 cells (not a proportion); project bootstrap descriptive; never Wilson', () => {
    const r = precisionF1Intervals(four, { seed: 1, resamples: 200 });
    expect(r6(r.f1.estimate)).toBe('0.685714');
    expect(r.f1.cell).toEqual({ ciLow: null, ciHigh: null, ciMethod: null });
    expect(r.f1.project.ciMethod).toBe('cluster-bootstrap');
    expect(r.f1.project.descriptive).toBe(true);
    expect(Object.keys(r.f1)).not.toContain('independent');
  });

  it('n < 10: counts only (TP + FP for precision; TP + FP and TP + FN for F1)', () => {
    const small = precisionF1Intervals([cell('p1', 'MO-A', 5, 4, 20)], { seed: 1 });
    expect(small.precision).toEqual({ estimate: null, cell: { ciLow: null, ciHigh: null, ciMethod: null }, project: { ciLow: null, ciHigh: null, ciMethod: null, descriptive: null }, independent: { ciLow: null, ciHigh: null, ciMethod: null } });
    const fewPositives = precisionF1Intervals([cell('p1', 'MO-A', 5, 6, 3)], { seed: 1 });
    expect(r6(fewPositives.precision.estimate)).toBe('0.454545'); // 5 / 11
    expect(fewPositives.f1.estimate).toBeNull(); // TP + FN = 8 < 10
  });

  it('precision 1 below 10 cells: Clopper-Pearson on the cells and on the violations; one project gives no project interval', () => {
    const r = precisionF1Intervals([cell('p1', 'MO-A', 4, 0, 0), cell('p1', 'MO-B', 3, 0, 1), cell('p1', 'MO-C', 3, 0, 0)], { seed: 1 });
    expect([r6(r.precision.cell.ciLow), r6(r.precision.cell.ciHigh), r.precision.cell.ciMethod]).toEqual(['0.292402', '1.000000', 'clopper-pearson-cells']);
    expect([r6(r.precision.independent.ciLow), r.precision.independent.ciMethod]).toEqual(['0.691503', 'clopper-pearson']);
    expect(r.precision.project).toEqual({ ciLow: null, ciHigh: null, ciMethod: null, descriptive: null });
  });

  it('10 or more cells: the cell bootstrap is primary; identical cells give a degenerate interval at the estimate', () => {
    // 10 cells on 10 projects, each TP 2, FP 1, FN 1: every resample has precision 2/3 and F1 4/6.
    const ten = Array.from({ length: 10 }, (_, i) => cell(`p${String(i)}`, 'MO-A', 2, 1, 1));
    const r = precisionF1Intervals(ten, { seed: 7, resamples: 300 });
    expect([r6(r.precision.cell.ciLow), r6(r.precision.cell.ciHigh), r.precision.cell.ciMethod]).toEqual(['0.666667', '0.666667', 'cell-bootstrap']);
    expect([r6(r.f1.cell.ciLow), r6(r.f1.cell.ciHigh), r.f1.cell.ciMethod]).toEqual(['0.666667', '0.666667', 'cell-bootstrap']);
    expect(r.precision.project.descriptive).toBe(false); // 10 projects: co-primary
    expect(r.f1.project.descriptive).toBe(false);
  });

  it('cells without TP and FP do not count as precision units; empty cells are ignored', () => {
    const r = precisionF1Intervals([...four, cell('p3', 'MO-A', 0, 0, 4), cell('p3', 'MO-B', 0, 0, 0)], { seed: 1, resamples: 50 });
    expect([r.nPrecisionCells, r.nF1Cells, r.fn]).toEqual([4, 5, 12]);
  });

  it('is deterministic for a seed', () => {
    const a = precisionF1Intervals(four, { seed: 3, resamples: 100 });
    const b = precisionF1Intervals(four, { seed: 3, resamples: 100 });
    expect(a).toEqual(b);
  });
});

describe('SO4 seed coverage and the golden N (ADR-021 SO4-03, SO4-05)', () => {
  const inst = (seedId: string, status: string, over: Partial<CoverageInput['instances'][number]> = {}): CoverageInput['instances'][number] => ({
    seedId, projectId: seedId.split(':')[0] ?? '', operatorId: seedId.split(':')[1] ?? '', split: 'held-out', baseKind: 'corpus',
    dimension: 'structural', status, specStyle: 'nestjs', ...over,
  });
  const input: CoverageInput = {
    instances: [
      inst('a:MO-S01:0', 'matched'), inst('a:MO-S01:1', 'missed'), inst('a:MO-C04:0', 'not-applicable'),
      inst('b:MO-S01:0', 'matched', { specStyle: 'layered' }), inst('b:MO-S01n:0', 'twin-clean', { dimension: null, specStyle: 'layered' }),
      inst('b:MO-P01:0', 'site-invalid', { specStyle: 'layered' }), inst('dev:MO-S01:0', 'matched', { split: 'dev', baseKind: 'fixture' }),
    ],
    rejectedPairs: [
      { seedId: 'a:MO-P01:0', projectId: 'a', operatorId: 'MO-P01', split: 'held-out', baseKind: 'corpus', golden: true, code: 'SCORE_INPUT_REJECTED', reason: 'a:MO-P01:0: seeded run rejected (transport-error)' },
      { seedId: 'b:MO-S01n:1', projectId: 'b', operatorId: 'MO-S01n', split: 'held-out', baseKind: 'corpus', golden: false, code: 'EDGE_EVIDENCE_UNAVAILABLE', reason: 'empty' },
    ],
    manifestRejections: [{ projectId: 'a', operatorId: 'MO-C02', reason: 'no-site', detail: 'no eligible site' }],
    corpusStyles: new Map([['a', 'nestjs'], ['b', 'layered']]),
  };

  it('the floor constants are the BR-U5a-37 values of the freeze gate', () => {
    expect([GOLDEN_FLOOR, GOLDEN_CEILING]).toEqual([K_TARGET_MIN, K_TARGET_MAX]);
  });

  it('isGoldenInstance: held-out, not a twin, with a dimension', () => {
    expect(isGoldenInstance({ split: 'held-out', status: 'missed', dimension: 'coupling' })).toBe(true);
    expect(isGoldenInstance({ split: 'held-out', status: 'twin-fired', dimension: null })).toBe(false);
    expect(isGoldenInstance({ split: 'dev', status: 'matched', dimension: 'coupling' })).toBe(false);
  });

  it('seed_coverage rows: every seed by id (scored or pair-rejected with its reason), then the mutate rejections', () => {
    const rows = seedCoverageRows('so4-heldout', input);
    expect(rows.map((r) => r.length)).toEqual(rows.map(() => SEED_COVERAGE_COLUMNS.length));
    expect(rows.map((r) => [r[1], r[8], r[9], r[10]])).toEqual([
      ['a:MO-C04:0', 'true', 'scored', 'not-applicable'],
      ['a:MO-P01:0', 'true', 'pair', 'rejected'],
      ['a:MO-S01:0', 'true', 'scored', 'matched'],
      ['a:MO-S01:1', 'true', 'scored', 'missed'],
      ['b:MO-P01:0', 'true', 'scored', 'site-invalid'],
      ['b:MO-S01:0', 'true', 'scored', 'matched'],
      ['b:MO-S01n:0', 'false', 'scored', 'twin-clean'],
      ['b:MO-S01n:1', 'false', 'pair', 'rejected'],
      ['dev:MO-S01:0', 'false', 'scored', 'matched'],
      ['', '', 'mutate', 'rejected'],
    ]);
    expect(rows[1]?.[11]).toBe('SCORE_INPUT_REJECTED: a:MO-P01:0: seeded run rejected (transport-error)');
    expect(rows[1]?.[6]).toBe('nestjs'); // corpus style from corpus.json for a rejected pair
    expect(rows[9]?.[11]).toBe('no-site: no eligible site');
  });

  it('golden N: 6 golden rows = 3 scored + 1 not applicable + 1 site invalid + 1 rejected pair; the floor row', () => {
    const rows = goldenNRows('so4-heldout', input, 85);
    expect(rows.every((r) => r.length === GOLDEN_N_COLUMNS.length)).toBe(true);
    const col = (r: string[] | undefined, c: (typeof GOLDEN_N_COLUMNS)[number]): string => r?.[GOLDEN_N_COLUMNS.indexOf(c)] ?? '<none>';
    const overall = rows[0];
    expect([col(overall, 'scope'), col(overall, 'n_golden'), col(overall, 'n_pair_rejected'), col(overall, 'n_not_applicable'), col(overall, 'n_site_invalid'),
      col(overall, 'n_scored'), col(overall, 'n_matched'), col(overall, 'n_missed'), col(overall, 'n_mutate_rejected'), col(overall, 'n_registered'),
      col(overall, 'floor'), col(overall, 'ceiling'), col(overall, 'floor_met'), col(overall, 'shortfall'), col(overall, 'above_ceiling')])
      .toEqual(['overall', '6', '1', '1', '1', '3', '2', '1', '1', '85', '80', '120', 'false', '77', 'false']);
    expect(col(overall, 'statement')).toBe(floorStatement(3, 85));
    expect(rows.map((r) => [col(r, 'scope'), col(r, 'key'), col(r, 'n_golden'), col(r, 'n_scored'), col(r, 'floor')])).toEqual([
      ['overall', '', '6', '3', '80'],
      ['project', 'a', '4', '2', ''],
      ['project', 'b', '2', '1', ''],
      ['spec_style', 'layered', '2', '1', ''],
      ['spec_style', 'nestjs', '3', '2', ''],
      ['corpus_style', 'layered', '2', '1', ''],
      ['corpus_style', 'nestjs', '4', '2', ''],
    ]);
  });

  it('floor statement: shortfall under ADR-019 item 1, within the floor, above the ceiling', () => {
    expect(floorStatement(69, undefined)).toBe('N = 69 scored golden instances, 11 below the floor of 80. Under ADR-019 item 1 the catalogue k stays frozen, SO4 is reported with the actual N, and the shortfall is a Ch7 deviation; no other lever is used.');
    expect(floorStatement(83, 85)).toBe('N = 83 scored golden instances, within the 80-120 floor (BR-U5a-37; ADR-019 item 1). Registered held-out golden total: 85; 2 of them yield no scored instance.');
    expect(floorStatement(80, undefined)).toContain('within the 80-120 floor');
    expect(floorStatement(121, undefined)).toBe('N = 121 scored golden instances, above the ceiling of 120 (BR-U5a-37).');
  });

  it('an empty score still has the overall row (N = 0, shortfall 80)', () => {
    const rows = goldenNRows('p', { instances: [], rejectedPairs: [], manifestRejections: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slice(1, 8)).toEqual(['overall', '', '0', '0', '0', '0', '0']);
    expect(rows[0]?.[GOLDEN_N_COLUMNS.indexOf('shortfall')]).toBe('80');
  });
});
