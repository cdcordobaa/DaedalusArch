/**
 * U6 Docs lane (ADR-021 X-5): thesis figure rules FIG-01..07 of `scripts/figures.ts`, on hand-computed fixture CSVs
 * in `tests/fixtures/u6/figures/` whose headers are the `scripts/aggregate.ts` headers (checked below).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { aggregate } from '../../../../scripts/aggregate.js';
import {
  DEFAULT_FIGURE_OPTIONS, FIG_CSV_SCHEMA, FIG_SENSITIVITY_PURPOSE, FIG_VALUE_INVALID, FIGURES, main, missingColumns, num,
  prepareCoverage, prepareFigure, prepareLatency, prepareSensitivity, prepareSo4Prf, prepareSo5Heatmap, prepareSo5Interaction,
  SENSITIVITY_CAPTION, specLevelOrder, specWithCaption, loadThesisSpec, thesisSpecIds, wrapCaption,
} from '../../../../scripts/figures.js';
import type { CsvTable, FigureDef } from '../../../../scripts/figures.js';
import { parseCsv } from '../../../../scripts/lib/figures/draw.js';
import { loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import { SENSITIVITY_COLUMNS } from '../../../../scripts/rescore.js';

const ROOT = resolve(__dirname, '../../../..');
const FIX = join(ROOT, 'tests/fixtures/u6/figures');
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
    const r = prepareFigure(def('so2-latency'), csv('run_id,project_id\nr1,p\n'));
    expect(r).toEqual({ ok: false, code: FIG_CSV_SCHEMA, detail: 'latency.csv lacks file_count, total_ms, cycle_query_ms, gate_result' });
  });

  it('a non-numeric value fails FIG_VALUE_INVALID through prepareFigure', () => {
    const r = prepareFigure(def('so2-latency'), csv('run_id,project_id,file_count,total_ms,cycle_query_ms,gate_result\nr1,p,ten,1,1,pass\n'));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe(FIG_VALUE_INVALID);
  });

  it('every required column is in the header aggregate.ts / rescore.ts actually writes', () => {
    const so5 = loadSo5Codes(ROOT);
    if (!so5.ok) throw new Error(so5.detail);
    const out = aggregate({ planId: 'x', records: [], reports: new Map(), so5: so5.codes });
    for (const d of FIGURES) {
      const header = (out.get(d.csv as never) ?? '').split('\n')[0]?.split(',') ?? [];
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
  });
});

describe('FIG-02 SO4 P/R/F1', () => {
  it('keeps the held-out all/all rows; precision labelled-else-strict; recall with its CI; F1 labelled-else-strict', () => {
    const rows = prepareSo4Prf(table('prf_by_function.csv'), DEFAULT_FIGURE_OPTIONS, 'function_id');
    expect(rows).toEqual([
      { group: 'FF-C01', metric: 'seeded differential precision', value: 1, basis: 'labelled', ci_low: null, ci_high: null, ci_method: '', n_seeded: 4 },
      { group: 'FF-C01', metric: 'recall', value: 0.75, basis: 'strict', ci_low: null, ci_high: null, ci_method: 'counts', n_seeded: 4 },
      { group: 'FF-C01', metric: 'F1', value: 0.857143, basis: 'labelled', ci_low: null, ci_high: null, ci_method: '', n_seeded: 4 },
      // tp + fp = 0: no precision, and so no strict F1; recall 0 with no CI.
      { group: 'FF-P06', metric: 'recall', value: 0, basis: 'strict', ci_low: null, ci_high: null, ci_method: 'counts', n_seeded: 4 },
      { group: 'FF-S01', metric: 'seeded differential precision', value: 1, basis: 'strict', ci_low: null, ci_high: null, ci_method: '', n_seeded: 8 },
      { group: 'FF-S01', metric: 'recall', value: 0.75, basis: 'strict', ci_low: 0.409, ci_high: 0.9285, ci_method: 'wilson', n_seeded: 8 },
      // 2 * 1 * 0.75 / 1.75 = 0.857142857 -> 0.857143
      { group: 'FF-S01', metric: 'F1', value: 0.857143, basis: 'strict', ci_low: null, ci_high: null, ci_method: '', n_seeded: 8 },
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

  it('precision and F1 intervals are taken only from explicit *_ci_low/_ci_high columns (SO4-06)', () => {
    const t = csv('split,base_kind,coverage,tp,fn,precision_strict,precision_labelled,recall,f1_labelled,ci_low,ci_high,ci_method,precision_ci_low,precision_ci_high,f1_ci_low,f1_ci_high,function_id\n'
      + 'held-out,all,all,3,1,0.750000,,0.750000,,0.3,0.95,cluster-bootstrap,0.4,0.9,0.5,0.85,FF-X\n');
    const rows = prepareSo4Prf(t, DEFAULT_FIGURE_OPTIONS, 'function_id');
    expect(rows.map((r) => [r.metric, r.ci_low, r.ci_high, r.ci_method])).toEqual([
      ['seeded differential precision', 0.4, 0.9, 'csv'], ['recall', 0.3, 0.95, 'cluster-bootstrap'], ['F1', 0.5, 0.85, 'csv'],
    ]);
  });

  it('per tag, a data-flow sub-row is labelled tag/sub_row', () => {
    const r = prepareFigure(def('so4-prf-by-tag'), table('prf_by_tag.csv'));
    expect(r.ok && [...new Set(r.rows.map((x) => x.group))]).toEqual(['structural', 'structural/data-flow']);
    // structural: 2 * 0.8 * 0.8 / 1.6 = 0.8
    expect(r.ok && r.rows.find((x) => x.group === 'structural' && x.metric === 'F1')?.value).toBe(0.8);
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
  it('latency: one row per run, seconds, over budget only above 30 s', () => {
    expect(prepareLatency(table('latency.csv'))).toEqual([
      { run_id: 'r1', project_id: 'proj-a', file_count: 120, total_s: 4.5, cycle_query_s: 1.2, gate_s: 30, gate_result: 'pass', over_budget: false },
      { run_id: 'r2', project_id: 'proj-b', file_count: 800, total_s: 61, cycle_query_s: 31, gate_s: 30, gate_result: 'fallback-required', over_budget: true },
      { run_id: 'r3', project_id: 'proj-c', file_count: 50, total_s: null, cycle_query_s: 0, gate_s: 30, gate_result: 'pass', over_budget: false },
    ]);
  });

  it('exactly 30 000 ms is not over budget', () => {
    const t = csv('run_id,project_id,file_count,total_ms,cycle_query_ms,gate_result\nr,p,1,1,30000,pass\n');
    expect(prepareLatency(t)[0]?.over_budget).toBe(false);
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
        execFileSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/figures-cli.ts'), '--csv-dir', FIX, '--out', o], { cwd: ROOT, stdio: 'pipe' });
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
      copyFileSync(join(FIX, 'latency.csv'), join(sparse, 'in', 'latency.csv'));
      writeFileSync(join(sparse, 'in', 'coverage.csv'), `${table('coverage.csv').header.join(',')}\n`);
      const text = execFileSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/figures-cli.ts'), '--csv-dir', join(sparse, 'in'), '--out', join(sparse, 'out')], { cwd: ROOT, stdio: 'pipe' }).toString('utf8');
      expect(text).toContain('skip so2-coverage: no rows in coverage.csv');
      expect(text).toContain('skip so4-prf-by-function: prf_by_function.csv not found');
      expect(readdirSync(join(sparse, 'out'))).toEqual(['so2-latency.svg']);
    } finally {
      for (const o of [...outs, sparse]) rmSync(o, { recursive: true, force: true });
    }
  }, 180_000);
});
