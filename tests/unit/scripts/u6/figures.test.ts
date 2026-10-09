/**
 * U6 Docs lane (ADR-021 X-5): thesis figure rules FIG-01..08 of `scripts/figures.ts`, on hand-computed fixture CSVs
 * in `tests/fixtures/u6/figures/` whose headers are the `scripts/aggregate.ts` headers (checked below).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { aggregate } from '../../../../scripts/aggregate.js';
import {
  DEFAULT_FIGURE_OPTIONS, FIG_CSV_SCHEMA, FIG_SENSITIVITY_PURPOSE, FIG_VALUE_INVALID, FIGURES, main, missingColumns, num,
  prepareCoverage, prepareFigure, prepareLatency, prepareSensitivity, prepareSo4Precision, prepareSo4Prf, prepareSo5Heatmap, prepareSo5Interaction,
  SENSITIVITY_CAPTION, specLevelOrder, specWithCaption, loadThesisSpec, thesisSpecIds, wrapCaption,
} from '../../../../scripts/figures.js';
import type { CsvTable, FigureDef } from '../../../../scripts/figures.js';
import { parseCsv } from '../../../../scripts/lib/figures/draw.js';
import { loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import { LATENCY_COLUMNS } from '../../../../scripts/lib/so2.js';
import { SENSITIVITY_COLUMNS } from '../../../../scripts/rescore.js';

const ROOT = resolve(__dirname, '../../../..');
const FIX = join(ROOT, 'tests/fixtures/u6/figures');
const FIX_SO2 = join(FIX, 'so2');
const table = (name: string): CsvTable => parseCsv(readFileSync(join(FIX, name), 'utf8'));
const csv = (text: string): CsvTable => parseCsv(text);
const def = (id: string): FigureDef => {
  const d = FIGURES.find((f) => f.id === id);
  if (d === undefined) throw new Error(id);
  return d;
};

describe('FIG-01 schema and cell readers', () => {
  it('missingColumns lists the absent required columns in required order', () => {
    expect(missingColumns(['a', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['b', 'd']);
    expect(missingColumns(['a'], [])).toEqual([]);
  });

  it('num: empty is null, a number parses, text is FIG_VALUE_INVALID', () => {
    expect(num({ x: '' }, 'x')).toBeNull();
    expect(num({}, 'x')).toBeNull();
    expect(num({ x: '0.250000' }, 'x')).toBe(0.25);
    expect(() => num({ x: 'abc' }, 'x')).toThrow(FIG_VALUE_INVALID);
  });

  it('a CSV without a required column fails FIG_CSV_SCHEMA and names it', () => {
    const r = prepareFigure(def('so2-coverage'), csv('run_id,parse_coverage,resolved_internal\nr1,1,0\n'));
    expect(r).toEqual({ ok: false, code: FIG_CSV_SCHEMA, detail: 'coverage.csv lacks external, external_out_of_root_alias, unresolved, dropped_no_file_node, unsupported_dynamic' });
  });

  it('a non-numeric value fails FIG_VALUE_INVALID through prepareFigure', () => {
    const r = prepareFigure(def('so2-latency'), csv(`${LATENCY_COLUMNS.join(',')}\nr1,pl,p,accepted,,ten,1,,1,ok,1,ok,30000,pass,\n`));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe(FIG_VALUE_INVALID);
  });

  it('every required column is in the header aggregate.ts / rescore.ts actually writes', () => {
    const so5 = loadSo5Codes(ROOT);
    if (!so5.ok) throw new Error(so5.detail);
    const out = aggregate({ planId: 'x', records: [], reports: new Map(), so5: so5.codes });
    for (const d of FIGURES) {
      const header = d.source === 'so2-metrics' ? [...LATENCY_COLUMNS] : (out.get(d.csv as never) ?? '').split('\n')[0]?.split(',') ?? [];
      expect({ id: d.id, missing: missingColumns(header, d.requiredColumns) }).toEqual({ id: d.id, missing: [] });
    }
    expect(missingColumns([...SENSITIVITY_COLUMNS], def('threshold-sensitivity').requiredColumns)).toEqual([]);
  });

  it('every fixture CSV header equals the aggregate.ts header', () => {
    const so5 = loadSo5Codes(ROOT);
    if (!so5.ok) throw new Error(so5.detail);
    const out = aggregate({ planId: 'x', records: [], reports: new Map(), so5: so5.codes });
    for (const f of readdirSync(FIX).filter((n) => n.endsWith('.csv'))) {
      expect({ f, header: table(f).header.join(',') }).toEqual({ f, header: (out.get(f as never) ?? '').split('\n')[0] });
    }
    // FIG-05 reads the so2-metrics latency.csv, never the aggregate's (ADR-021 item 8).
    expect(parseCsv(readFileSync(join(FIX_SO2, 'latency.csv'), 'utf8')).header).toEqual([...LATENCY_COLUMNS]);
    expect(FIGURES.filter((d) => d.source === 'so2-metrics').map((d) => d.csv)).toEqual(['latency.csv']);
  });
});

const NO_PROJECT = {
  ci_project_low: null, ci_project_high: null, ci_project_method: '', ci_project_descriptive: null,
  ci_independent_low: null, ci_independent_high: null, ci_independent_method: '',
};

describe('FIG-02 SO4 P/R/F1', () => {
  it('keeps the held-out all/all rows; precision labelled-else-strict, baseline beside it; recall with both intervals; F1 labelled-else-strict', () => {
    const rows = prepareSo4Prf(table('prf_by_function.csv'), DEFAULT_FIGURE_OPTIONS, 'function_id');
    const counts = { ...NO_PROJECT, ci_project_method: 'counts', ci_independent_method: 'counts' };
    expect(rows).toEqual([
      { group: 'FF-C01', metric: 'seeded differential precision', value: 1, basis: 'labelled', ci_low: null, ci_high: null, ci_method: '', ...NO_PROJECT, n_seeded: 4 },
      { group: 'FF-C01', metric: 'baseline precision', value: 0.666667, basis: 'baseline', ci_low: null, ci_high: null, ci_method: '', ...NO_PROJECT, n_seeded: 4 },
      { group: 'FF-C01', metric: 'recall', value: 0.75, basis: 'strict', ci_low: null, ci_high: null, ci_method: 'counts', ...counts, n_seeded: 4 },
      { group: 'FF-C01', metric: 'F1', value: 0.857143, basis: 'labelled', ci_low: null, ci_high: null, ci_method: '', ...NO_PROJECT, n_seeded: 4 },
      // tp + fp = 0: no precision, and so no strict F1; no baseline either (empty cell); recall 0 with no CI.
      { group: 'FF-P06', metric: 'recall', value: 0, basis: 'strict', ci_low: null, ci_high: null, ci_method: 'counts', ...counts, n_seeded: 4 },
      { group: 'FF-S01', metric: 'seeded differential precision', value: 1, basis: 'strict', ci_low: null, ci_high: null, ci_method: '', ...NO_PROJECT, n_seeded: 8 },
      { group: 'FF-S01', metric: 'baseline precision', value: 0.9, basis: 'baseline', ci_low: null, ci_high: null, ci_method: '', ...NO_PROJECT, n_seeded: 8 },
      // 3 projects: the project cluster interval is drawn and flagged descriptive (2..9 projects, ADR-020 item 3).
      // Wilson with z = 1.959964 (z^2 = 3.841459).
      // Cell interval: 4 (project, operator) cells at k = 2, recall 0.75, Wilson n = 4:
      //   centre (0.75 + z^2/8) / (1 + z^2/4) = 1.230182 / 1.960365 = 0.627527,
      //   half z * sqrt(0.75 * 0.25 / 4 + z^2/64) / 1.960365 = 0.326885 -> [0.300642, 0.954413].
      // If-independent bound (TV-22): instance Wilson 6 / 8:
      //   centre (0.75 + z^2/16) / (1 + z^2/8) = 0.990091 / 1.480182 = 0.668898,
      //   half z * sqrt(0.75 * 0.25 / 8 + z^2/256) / 1.480182 = 0.259623 -> [0.409275, 0.928521].
      // The independent bound is narrower than the cell interval, as the √k argument of TV-22 predicts.
      {
        group: 'FF-S01', metric: 'recall', value: 0.75, basis: 'strict', ci_low: 0.300642, ci_high: 0.954413, ci_method: 'wilson',
        ci_project_low: 0.35, ci_project_high: 0.95, ci_project_method: 'cluster-bootstrap', ci_project_descriptive: true,
        ci_independent_low: 0.409275, ci_independent_high: 0.928521, ci_independent_method: 'wilson', n_seeded: 8,
      },
      // 2 * 1 * 0.75 / 1.75 = 0.857142857 -> 0.857143
      { group: 'FF-S01', metric: 'F1', value: 0.857143, basis: 'strict', ci_low: null, ci_high: null, ci_method: '', ...NO_PROJECT, n_seeded: 8 },
    ]);
  });

  it('the split option selects the dev rows instead', () => {
    const rows = prepareSo4Prf(table('prf_by_function.csv'), { split: 'dev' }, 'function_id');
    expect(rows.map((r) => [r.group, r.metric, r.value])).toEqual([
      ['FF-S01', 'seeded differential precision', 1], ['FF-S01', 'recall', 1], ['FF-S01', 'F1', 1],
    ]);
  });

  it('strict F1 is 0 when precision and recall are both 0', () => {
    const t = csv('split,base_kind,coverage,tp,fn,precision_strict,precision_labelled,recall,f1_labelled,ci_low,ci_high,ci_method,function_id\nheld-out,all,all,0,3,0,,0,,,,counts,FF-X\n');
    expect(prepareSo4Prf(t, DEFAULT_FIGURE_OPTIONS, 'function_id').find((r) => r.metric === 'F1')?.value).toBe(0);
  });

  it('both P/R/F1 specs draw the cell, project and if-independent intervals as three rule layers (TV-22)', () => {
    for (const id of ['so4-prf-by-function', 'so4-prf-by-tag']) {
      const layers = loadThesisSpec(ROOT, def(id)).layer as { mark: { type: string }; encoding?: { x?: { field?: string }; x2?: { field?: string } } }[];
      const rules = layers.filter((l) => l.mark.type === 'rule').map((l) => [l.encoding?.x?.field, l.encoding?.x2?.field]);
      expect({ id, rules }).toEqual({ id, rules: [['ci_independent_low', 'ci_independent_high'], ['ci_low', 'ci_high'], ['ci_project_low', 'ci_project_high']] });
      expect(def(id).caption).toContain('TV-22');
    }
  });

  it('precision and F1 take their PRF_INTERVAL_COLUMNS intervals on the plotted basis; F1 has no if-independent bound (SO4-06)', () => {
    const rows = prepareSo4Prf(table('prf_by_tag.csv'), DEFAULT_FIGURE_OPTIONS, 'tag').filter((r) => r.group === 'structural');
    const pick = (m: string): unknown[] => {
      const r = rows.find((x) => x.metric === m);
      return [r?.basis, r?.ci_low, r?.ci_high, r?.ci_method, r?.ci_project_low, r?.ci_project_high, r?.ci_project_descriptive, r?.ci_independent_low, r?.ci_independent_high, r?.ci_independent_method];
    };
    // tp 8, fp 2 on 5 cells (strict): precision 0.8; cell Wilson n = 5 [0.375535, 0.963776]; Wilson 8 / 10 [0.490162, 0.943318].
    expect(pick('seeded differential precision')).toEqual(['strict', 0.375535, 0.963776, 'wilson-cells', 0.6, 1, true, 0.490162, 0.943318, 'wilson']);
    // F1 = 2 * 0.8 * 0.8 / 1.6 = 0.8; 5 < 10 cells, so no cell interval, only the descriptive project bootstrap.
    expect(rows.find((x) => x.metric === 'F1')?.value).toBe(0.8);
    expect(pick('F1')).toEqual(['strict', null, null, '', 0.55, 0.95, true, null, null, '']);
  });

  it('an interval of another basis than the plotted point is not attached (FF-C01: labelled point, strict interval columns)', () => {
    const rows = prepareSo4Prf(table('prf_by_function.csv'), DEFAULT_FIGURE_OPTIONS, 'function_id').filter((r) => r.group === 'FF-C01' && (r.metric === 'seeded differential precision' || r.metric === 'F1'));
    expect(rows.map((r) => [r.metric, r.basis, r.ci_low, r.ci_high, r.ci_project_low, r.ci_project_high])).toEqual([
      ['seeded differential precision', 'labelled', null, null, null, null], ['F1', 'labelled', null, null, null, null],
    ]);
  });

  it('no precision or F1 interval is invented: blank interval columns (n < 10) give none even when recall has all three', () => {
    const rows = prepareSo4Prf(table('prf_by_function.csv'), DEFAULT_FIGURE_OPTIONS, 'function_id').filter((r) => r.group === 'FF-S01' && r.metric !== 'recall');
    expect(rows.map((r) => [r.ci_low, r.ci_high, r.ci_project_low, r.ci_project_high])).toEqual([[null, null, null, null], [null, null, null, null], [null, null, null, null]]);
  });

  it('a ci_project_descriptive cell other than true / false / empty fails FIG_VALUE_INVALID', () => {
    const t = csv('split,base_kind,coverage,tp,fn,precision_strict,precision_labelled,recall,f1_labelled,ci_low,ci_high,ci_method,ci_project_low,ci_project_high,ci_project_method,ci_project_descriptive,function_id\n'
      + 'held-out,all,all,3,1,0.750000,,0.750000,,,,counts,0.4,0.9,cluster-bootstrap,yes,FF-X\n');
    const r = prepareFigure({ ...def('so4-prf-by-function'), requiredColumns: [] }, t);
    expect(!r.ok && r.code).toBe(FIG_VALUE_INVALID);
  });

  it('per tag, a data-flow sub-row is labelled tag/sub_row; no baseline column, no baseline row', () => {
    const r = prepareFigure(def('so4-prf-by-tag'), table('prf_by_tag.csv'));
    expect(r.ok && [...new Set(r.rows.map((x) => x.group))]).toEqual(['structural', 'structural/data-flow']);
    // structural: 2 * 0.8 * 0.8 / 1.6 = 0.8
    expect(r.ok && r.rows.find((x) => x.group === 'structural' && x.metric === 'F1')?.value).toBe(0.8);
    expect(r.ok && r.rows.some((x) => x.metric === 'baseline precision')).toBe(false);
    expect(r.ok && r.rows.find((x) => x.group === 'structural' && x.metric === 'recall')?.ci_project_high).toBe(0.95);
    // 5 cells, recall 0.8: Wilson n = 5, centre 1.184146 / 1.768292 = 0.669655, half 0.294121 -> [0.375535, 0.963776];
    // if independent, Wilson 8 / 10: centre 0.992073 / 1.384146 = 0.716740, half 0.226578 -> [0.490162, 0.943318] (narrower).
    const rec = r.ok ? r.rows.find((x) => x.group === 'structural' && x.metric === 'recall') : undefined;
    expect([rec?.ci_low, rec?.ci_high, rec?.ci_independent_low, rec?.ci_independent_high]).toEqual([0.375535, 0.963776, 0.490162, 0.943318]);
  });
});

describe('FIG-08 SO4 precision', () => {
  it('overall first, then functions ascending; labelled, strict, baseline; an empty estimate is skipped', () => {
    const rows = prepareSo4Precision(table('precision_figure.csv'));
    expect(rows.map((r) => [r.group, r.measure, r.value, r.ci_low, r.ci_high, r.ci_method, r.n])).toEqual([
      ['overall', 'seeded differential (FP-labelled)', 0.9, 0.596, 0.982, 'wilson', 10],
      ['overall', 'seeded differential (FP-strict)', 0.8, 0.49, 0.943, 'wilson', 10],
      ['overall', 'baseline (HT-weighted TP-class share)', 0.75, 0.5, 0.9, 'cluster-bootstrap', 12],
      ['FF-C01', 'seeded differential (FP-labelled)', 1, 0.439, 1, 'clopper-pearson', 3],
      ['FF-C01', 'seeded differential (FP-strict)', 0.75, 0.301, 0.954, 'wilson', 4],
      ['FF-C01', 'baseline (HT-weighted TP-class share)', 0.666667, 0.208, 0.939, 'cluster-bootstrap', 3],
      // FF-S01 baseline has no estimate (no P2 labels for it) and is not drawn.
      ['FF-S01', 'seeded differential (FP-strict)', 1, 0.676, 1, 'wilson', 8],
    ]);
    expect(rows.every((r) => !('_m' in r))).toBe(true);
  });

  it('an unknown measure or scope fails FIG_VALUE_INVALID', () => {
    const head = 'plan_id,scope,function_id,measure,estimate,ci_low,ci_high,ci_method,n\n';
    const bad = prepareFigure(def('so4-precision'), csv(`${head}fx,overall,,precision_tuned,0.9,,,,1\n`));
    expect(!bad.ok && [bad.code, bad.detail]).toEqual([FIG_VALUE_INVALID, 'precision_figure.csv: FIG_VALUE_INVALID: measure "precision_tuned"']);
    const scope = prepareFigure(def('so4-precision'), csv(`${head}fx,tag,,baseline,0.9,,,,1\n`));
    expect(!scope.ok && scope.code).toBe(FIG_VALUE_INVALID);
  });
});

describe('FIG-03 / FIG-04 SO5', () => {
  it('spec levels follow SPEC_LEVELS; an unknown level sorts last', () => {
    expect(['none', 'minimal-prose', 'full-aac', 'other'].map(specLevelOrder)).toEqual([0, 1, 2, 3]);
  });

  it('the heatmap gives the mean over valid runs and n valid / n cells, both co-primary outcomes', () => {
    const rows = prepareSo5Heatmap(table('so5_grid.csv'));
    expect(rows.map((r) => [r.outcome, r.model, r.spec_level, r.mean, r.n_valid, r.n_cells, r.label])).toEqual([
      // haiku/none: ahsCombined 0.7 and 0.5 (the third run is not-run) -> 0.6, 2/3
      ['verdict-source AHS', 'claude-haiku-4-5', 'none', 0.6, 2, 3, '0.600 (2/3)'],
      // verdict_source ahsDeterministic -> the deterministic column
      ['verdict-source AHS', 'claude-haiku-4-5', 'full-aac', 0.9, 1, 1, '0.900 (1/1)'],
      ['verdict-source AHS', 'claude-opus-5-5', 'none', 0.45, 1, 1, '0.450 (1/1)'],
      // a rejected run is not valid
      ['verdict-source AHS', 'claude-opus-5-5', 'minimal-prose', null, 0, 1, 'n/a (0/1)'],
      ['ahsDeterministic', 'claude-haiku-4-5', 'none', 0.7, 2, 3, '0.700 (2/3)'],
      ['ahsDeterministic', 'claude-haiku-4-5', 'full-aac', 0.9, 1, 1, '0.900 (1/1)'],
      ['ahsDeterministic', 'claude-opus-5-5', 'none', 0.4, 1, 1, '0.400 (1/1)'],
      ['ahsDeterministic', 'claude-opus-5-5', 'minimal-prose', null, 0, 1, 'n/a (0/1)'],
    ]);
  });

  it('the interaction rows are the valid runs per outcome', () => {
    const rows = prepareSo5Interaction(table('so5_grid.csv'));
    expect(rows.map((r) => [r.outcome, r.model, r.spec_level, r.run_index, r.value])).toEqual([
      ['verdict-source AHS', 'claude-haiku-4-5', 'none', 0, 0.7],
      ['verdict-source AHS', 'claude-haiku-4-5', 'none', 1, 0.5],
      ['verdict-source AHS', 'claude-haiku-4-5', 'full-aac', 0, 0.9],
      ['verdict-source AHS', 'claude-opus-5-5', 'none', 0, 0.45],
      ['ahsDeterministic', 'claude-haiku-4-5', 'none', 0, 0.6],
      ['ahsDeterministic', 'claude-haiku-4-5', 'none', 1, 0.8],
      ['ahsDeterministic', 'claude-haiku-4-5', 'full-aac', 0, 0.9],
      ['ahsDeterministic', 'claude-opus-5-5', 'none', 0, 0.4],
    ]);
  });

  it('an accepted row with an unknown verdict_source is FIG_VALUE_INVALID', () => {
    const t = table('so5_grid.csv');
    const bad: CsvTable = { header: t.header, rows: [{ ...t.rows[0], verdict_source: 'ahs' }] };
    const r = prepareFigure(def('so5-grid-heatmap'), bad);
    expect(!r.ok && r.code).toBe(FIG_VALUE_INVALID);
  });
});

describe('FIG-05 / FIG-06 SO2', () => {
  it('latency: one row per run and cycle query, seconds; timeout or > budget exceeds; ast-only arms left out', () => {
    const rows = prepareLatency(parseCsv(readFileSync(join(FIX_SO2, 'latency.csv'), 'utf8')));
    expect(rows.map((r) => [r.run_id, r.status, r.file_count, r.total_s, r.query, r.query_s, r.query_status, r.budget_s, r.exceeds, r.gate_result])).toEqual([
      ['r1', 'accepted', 120, 4.5, 'FF-S02', 1.2, 'ok', 30, false, 'pass'],
      ['r1', 'accepted', 120, 4.5, 'universal cycle metric', 0.8, 'ok', 30, false, 'pass'],
      // a rejected run is kept: FF-S02 timed out (no ms), the universal query took 31 000 ms > 30 000
      ['r2', 'rejected', 800, 61, 'FF-S02', null, 'timeout', 30, true, 'fallback-required'],
      ['r2', 'rejected', 800, 61, 'universal cycle metric', 31, 'ok', 30, true, 'fallback-required'],
      // exactly 30 000 ms is not over budget; an empty budget_ms falls back to LATENCY_GATE_MS
      ['r3', 'accepted', 50, null, 'FF-S02', 30, 'ok', 30, false, 'inconclusive'],
      ['r3', 'accepted', 50, null, 'universal cycle metric', null, 'absent', 30, false, 'inconclusive'],
      ['r4', 'not-run', null, null, 'FF-S02', null, 'absent', 30, false, 'inconclusive'],
      ['r4', 'not-run', null, null, 'universal cycle metric', null, 'absent', 30, false, 'inconclusive'],
    ]);
    expect(rows.some((r) => String(r.project_id).endsWith('@ast-only'))).toBe(false);
  });

  it('coverage: parse rows, import shares of the six outcomes, no shares when they sum to 0', () => {
    const rows = prepareCoverage(table('coverage.csv'));
    expect(rows.filter((r) => r.kind === 'parse')).toEqual([
      { run_id: 'r1', kind: 'parse', measure: 'parse coverage', share: 0.95, count: null },
      { run_id: 'r2', kind: 'parse', measure: 'parse coverage', share: 1, count: null },
    ]);
    // r1: 80 + 15 + 0 + 4 + 1 + 0 = 100
    expect(rows.filter((r) => r.run_id === 'r1' && r.kind === 'import').map((r) => [r.measure, r.share, r.count])).toEqual([
      ['resolved_internal', 0.8, 80], ['external', 0.15, 15], ['external_out_of_root_alias', 0, 0], ['unresolved', 0.04, 4],
      ['dropped_no_file_node', 0.01, 1], ['unsupported_dynamic', 0, 0],
    ]);
    expect(rows.some((r) => r.run_id === 'r2' && r.kind === 'import')).toBe(false);
    expect(rows.filter((r) => r.run_id === 'r3').map((r) => r.share)).toEqual([1, 0, 0, 0, 0, 0]);
  });
});

describe('FIG-07 threshold sweep (BR-U5b-60)', () => {
  it('rows sorted by run and AHS field, threshold bands before neural variants', () => {
    expect(prepareSensitivity(table('rescore_sensitivity.csv')).map((r) => [r.row_label, r.kind, r.scenario, r.scenario_label, r.ahs, r.verdict])).toEqual([
      ['r1 · ahsCombined', 'threshold band', 'thresholds:0.75/0.60/0.45', '0.75/0.60/0.45', 0.7, 'warning'],
      ['r1 · ahsCombined', 'neural aggregation', 'neural:any-fail', 'any-fail', 0.64, 'soft-block'],
      ['r1 · ahsDeterministic', 'threshold band', 'thresholds:0.75/0.60/0.45', '0.75/0.60/0.45', 0.78, 'pass'],
      ['r1 · ahsDeterministic', 'threshold band', 'thresholds:0.85/0.70/0.55', '0.85/0.70/0.55', 0.78, 'warning'],
    ]);
  });

  it('a row whose purpose is not sensitivity-only refuses the figure', () => {
    const t = table('rescore_sensitivity.csv');
    const r = prepareFigure(def('threshold-sensitivity'), { header: t.header, rows: [...t.rows, { ...t.rows[0], purpose: 'tuning' }] });
    expect(r).toEqual({ ok: false, code: FIG_SENSITIVITY_PURPOSE, detail: `rescore_sensitivity.csv: ${FIG_SENSITIVITY_PURPOSE}: row 5 has purpose "tuning"` });
  });

  it('the caption carries "sensitivity-only, not tuning"', () => {
    expect(def('threshold-sensitivity').caption).toContain(SENSITIVITY_CAPTION);
  });
});

describe('registry and specs', () => {
  it('every registry figure has exactly one spec file, and every spec file a registry entry', () => {
    expect(thesisSpecIds(ROOT)).toEqual(FIGURES.map((f) => f.id).sort());
  });

  it('ids, SVG names are unique; sections are register keys; each spec names its figure', () => {
    expect(new Set(FIGURES.map((f) => f.id)).size).toBe(FIGURES.length);
    expect(new Set(FIGURES.map((f) => f.svg)).size).toBe(FIGURES.length);
    const register = readFileSync(join(ROOT, 'Docs/threats-to-validity.md'), 'utf8');
    for (const f of FIGURES) {
      expect(register).toContain(`| ${f.section} |`);
      expect((loadThesisSpec(ROOT, f).usermeta as { figure?: string }).figure).toBe(f.id);
    }
  });

  it('specWithCaption sets the registry title and caption and drops usermeta', () => {
    const d = def('so2-latency');
    const s = specWithCaption(d, { usermeta: { figure: d.id }, mark: 'bar' });
    expect(s).toEqual({ mark: 'bar', title: { text: d.title, subtitle: wrapCaption(d.caption), anchor: 'start', subtitleFontSize: 10 } });
  });

  it('wrapCaption breaks at word boundaries within the width; a longer word keeps its own line', () => {
    expect(wrapCaption('aa bb cc dd', 5)).toEqual(['aa bb', 'cc dd']);
    expect(wrapCaption('a verylongword b', 4)).toEqual(['a', 'verylongword', 'b']);
    expect(wrapCaption('  ', 10)).toEqual([]);
    for (const f of FIGURES) expect(wrapCaption(f.caption).join(' ')).toBe(f.caption.replace(/\s+/g, ' '));
  });

  it('--self-test refuses the built-in tuning row and exits 1; --list prints every figure', async () => {
    let s = '';
    const io = { out: (t: string) => { s += t; }, err: (t: string) => { s += t; }, writeFile: () => { throw new Error('write'); } };
    expect(await main(['--self-test'], ROOT, io)).toBe(1);
    expect(s).toContain(`self-test: ${FIG_SENSITIVITY_PURPOSE}`);
    s = '';
    expect(await main(['--list'], ROOT, io)).toBe(0);
    expect(s.trim().split('\n')).toHaveLength(FIGURES.length);
    expect(await main([], ROOT, io)).toBe(2);
  });
});

describe('CLI (tsx / ESM route)', () => {
  it('draws every figure from the fixture CSVs, byte-identically; header-only CSVs and absent CSVs are skipped', () => {
    const outs = [mkdtempSync(join(tmpdir(), 'u6-fig-a-')), mkdtempSync(join(tmpdir(), 'u6-fig-b-'))];
    const sparse = mkdtempSync(join(tmpdir(), 'u6-fig-sparse-'));
    try {
      for (const o of outs) {
        execFileSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/figures-cli.ts'), '--csv-dir', FIX, '--so2-dir', FIX_SO2, '--out', o], { cwd: ROOT, stdio: 'pipe' });
      }
      const svgs = outs.map((o) => readdirSync(o).filter((f) => f.endsWith('.svg')).sort());
      expect(svgs[0]).toEqual(FIGURES.map((f) => f.svg).sort());
      for (const f of svgs[0] ?? []) {
        const [a, b] = outs.map((o) => readFileSync(join(o, f)));
        expect({ f, same: a?.equals(b ?? Buffer.alloc(0)) }).toEqual({ f, same: true });
        expect(a?.toString('utf8').startsWith('<svg')).toBe(true);
      }
      expect(readFileSync(join(outs[0] ?? '', 'threshold-sensitivity.svg'), 'utf8')).toContain(SENSITIVITY_CAPTION);

      mkdirSync(join(sparse, 'in'));
      // the aggregate's latency.csv in --csv-dir is never read by FIG-05; without --so2-dir the figure is skipped
      writeFileSync(join(sparse, 'in', 'latency.csv'), 'run_id,project_id,file_count,total_ms,stage,stage_ms,cycle_query_ms,gate_result\nr1,p,1,1,parse,1,1,pass\n');
      copyFileSync(join(FIX, 'so5_grid.csv'), join(sparse, 'in', 'so5_grid.csv'));
      writeFileSync(join(sparse, 'in', 'coverage.csv'), `${table('coverage.csv').header.join(',')}\n`);
      const text = execFileSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/figures-cli.ts'), '--csv-dir', join(sparse, 'in'), '--out', join(sparse, 'out')], { cwd: ROOT, stdio: 'pipe' }).toString('utf8');
      expect(text).toContain('skip so2-coverage: no rows in coverage.csv');
      expect(text).toContain('skip so4-prf-by-function: prf_by_function.csv not found');
      expect(text).toContain('skip so2-latency: no --so2-dir');
      expect(readdirSync(join(sparse, 'out')).sort()).toEqual(['so5-grid-heatmap.svg', 'so5-interaction.svg']);
    } finally {
      for (const o of [...outs, sparse]) rmSync(o, { recursive: true, force: true });
    }
  }, 180_000);
});
