/**
 * ADR-021 SO4 lane, hand-computed:
 * - SO4-03: a rejected or incomplete pair is listed with its reason and does not stop the score;
 * - SO4-04: the run-to-score-case adapter (`build-score-case`), and `pairRuns` / `loadCase` without a hard stop;
 * - SO4-06: precision and F1 interval columns in the P/R/F1 files (labelled and strict basis);
 * - SO4-05: `seed_coverage.csv` and `golden_instances.csv` from a score;
 * - SO1-C: style strata, the style columns of `denominators.csv` and `prf_by_project.csv`.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  canonicalGoldenScore, EDGE_EVIDENCE_UNAVAILABLE, loadCase, pairRuns, reportPathOfRun, SCORE_INPUT_REJECTED, scoreDifferential, strataOf,
} from '../../../../scripts/score-golden.js';
import type { GoldenScore, ReconciledP1Label, ScoreInput, ScoreOutcome } from '../../../../scripts/score-golden.js';
import { CASE_INPUT_INVALID, CASE_OUT_NOT_EMPTY, main as caseMain, manifestPathOf, planScoreCase } from '../../../../scripts/build-score-case.js';
import { aggregate, PRF_INTERVAL_COLUMNS } from '../../../../scripts/aggregate.js';
import type { AggregateInput, GoldenScoreJson } from '../../../../scripts/aggregate.js';
import { parseCsv } from '../../../../scripts/lib/figures/draw.js';
import { loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import type { ManifestRow } from '../../../../scripts/lib/manifest.js';
import type { RunRecord } from '../../../../scripts/lib/report-io.js';
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import { ROOT, SPEC_SHA, key, record, report, row, rule, seed } from '../u5b/score-fixture.js';
import type { V } from '../u5b/score-fixture.js';

const D = 'src/domain/Task.ts';
const I = 'src/infra/Repo.ts';
const IMP = ['IMPORTS'];
const S01_KEY = key('FF-S01', D, I, IMP, 'site-line', 3);
const S01_V: V = { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 };
const HELD_OUT = JSON.stringify(['held-out', 'all', 'all']);
const so5 = ((): ReturnType<typeof loadSo5Codes> & { ok: true } => {
  const l = loadSo5Codes(ROOT);
  if (!l.ok) throw new Error(l.detail);
  return l;
})().codes;

function ok(o: ScoreOutcome): GoldenScore {
  if (!o.ok) throw new Error(`${o.code}: ${o.detail}`);
  return o.score;
}
const score = (input: Omit<ScoreInput, 'rule'>): ScoreOutcome => scoreDifferential({ rule: rule(), ...input });
const s01Row = (seedId: string): ManifestRow => row({ seedId, expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });

describe('a rejected pair does not stop the score (ADR-021 SO4-03; MAT-25)', () => {
  it('a missing seeded RunRecord rejects that pair only; the other pair is scored', async () => {
    const s = ok(score({
      seeds: [
        seed(s01Row('p:MO-S01:0'), await report([]), await report([S01_V])),
        seed(s01Row('p:MO-S01:1'), await report([]), await report([S01_V]), { seeded: null }),
      ],
    }));
    expect(s.perInstance.map((i) => [i.seedId, i.status])).toEqual([['p:MO-S01:0', 'matched']]);
    expect(s.rejectedPairs).toEqual([{
      seedId: 'p:MO-S01:1', projectId: 'p', operatorId: 'MO-S01', split: 'held-out', baseKind: 'corpus', golden: true,
      code: SCORE_INPUT_REJECTED, reason: 'p:MO-S01:1: seeded report without its RunRecord',
    }]);
    expect(s.overall.get(HELD_OUT)?.strict).toMatchObject({ tp: 1, fn: 0 });
  });

  it('a run record that is not accepted rejects the pair with the harness reason', async () => {
    const s = ok(score({
      seeds: [
        seed(s01Row('p:MO-S01:0'), await report([]), await report([S01_V])),
        seed(s01Row('p:MO-S01:1'), await report([]), await report([S01_V]), {
          seeded: record({ status: 'rejected', reasonCode: 'transport-error', reasonDetail: 'socket hang up' }),
        }),
        seed(s01Row('p:MO-S01:2'), await report([]), await report([S01_V]), { baseline: record({ status: 'incomplete', reasonCode: 'usage-limit' }) }),
      ],
    }));
    expect(s.rejectedPairs.map((r) => r.reason)).toEqual([
      'p:MO-S01:1: seeded run rejected (transport-error: socket hang up)',
      'p:MO-S01:2: baseline run incomplete (usage-limit)',
    ]);
  });

  it('unavailable FLOWS_TO evidence rejects the pair as EDGE_EVIDENCE_UNAVAILABLE; the rest are scored', async () => {
    const df01 = row({
      seedId: 'p:MO-DF01:0',
      expected: { functionIds: ['FF-P06'], dimension: 'pattern', keys: [key('FF-P06', D, I, ['Task'])], expectedEdges: [{ type: 'FLOWS_TO', source: 'A', target: 'B', via: 'new' }] },
    });
    const noEdges = await report([]);
    (noEdges as unknown as EvaluationReport & { graphStats: { edgeCountByType: Record<string, number> } }).graphStats.edgeCountByType = {};
    const s = ok(score({ seeds: [seed(df01, await report([]), noEdges), seed(s01Row('p:MO-S01:0'), await report([]), await report([S01_V]))] }));
    expect(s.rejectedPairs.map((r) => [r.seedId, r.code])).toEqual([['p:MO-DF01:0', EDGE_EVIDENCE_UNAVAILABLE]]);
    expect(s.perInstance.map((i) => i.seedId)).toEqual(['p:MO-S01:0']);
  });

  it('every pair rejected: the score is refused with the first code and every reason', async () => {
    const o = score({
      seeds: [
        seed(s01Row('p:MO-S01:0'), await report([]), await report([S01_V]), { seeded: null }),
        seed(s01Row('p:MO-S01:1'), await report([]), await report([S01_V]), { baseline: null }),
      ],
    });
    expect(o.ok).toBe(false);
    if (o.ok) return;
    expect(o.code).toBe(SCORE_INPUT_REJECTED);
    expect(o.detail).toBe('p:MO-S01:0: seeded report without its RunRecord; p:MO-S01:1: baseline report without its RunRecord');
  });

  it('a dev or twin row is listed as not golden; manifest rejections are carried', async () => {
    const twin = row({ seedId: 'p:MO-S01n:0', expected: { negative: true, twinOf: 'MO-S01', functionIds: [], keys: [] } });
    const dev = row({ seedId: 'f:MO-S01:0', split: 'dev', baseKind: 'fixture', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });
    const s = ok(score({
      seeds: [
        seed(s01Row('p:MO-S01:0'), await report([]), await report([S01_V])),
        seed(twin, await report([]), await report([]), { seeded: null }),
        seed(dev, await report([]), await report([]), { seeded: null }),
      ],
      rejections: [{ projectId: 'p', operatorId: 'MO-C02', reason: 'no-site', detail: 'none', appliedAt: '2026-10-09T00:00:00Z' } as never],
    }));
    expect(s.rejectedPairs.map((r) => [r.seedId, r.golden])).toEqual([['f:MO-S01:0', false], ['p:MO-S01n:0', false]]);
    expect(s.manifestRejections).toEqual([{ projectId: 'p', operatorId: 'MO-C02', reason: 'no-site', detail: 'none' }]);
  });
});

describe('pairRuns / loadCase never stop on a missing run (ADR-021 SO4-03, 04)', () => {
  const rows = [s01Row('p:MO-S01:0'), s01Row('p:MO-S01:1'), s01Row('p:MO-S01:2'), s01Row('p:MO-S01:3')];
  const seedRef = (seedId: string, baselineReportPath: string): NonNullable<RunRecord['seed']> => ({
    seedId, baseProjectId: 'p', split: 'held-out', baseKind: 'corpus', manifestPath: 'm/manifest.json', baselineReportPath,
  });
  const base = record({ runId: 'so4-000-p', reportPath: 'reports/so4-000-p.json' });
  const failedBase = record({ runId: 'so4-005-q', status: 'rejected', reasonCode: 'transport-error' }); // stored no report
  const records: RunRecord[] = [
    base, failedBase,
    record({ runId: 'so4-001-s0', reportPath: 'reports/so4-001-s0.json', seed: seedRef('p:MO-S01:0', 'reports/so4-000-p.json') }),
    record({ runId: 'so4-002-s1', reportPath: 'reports/so4-002-s1.json', seed: seedRef('p:MO-S01:1', reportPathOfRun('so4-005-q')) }),
    record({ runId: 'so4-003-s2', reportPath: 'reports/so4-003-s2.json', seed: seedRef('p:MO-S01:2', 'reports/so4-000-p.json') }),
  ];
  const present = new Set(['reports/so4-000-p.json', 'reports/so4-001-s0.json', 'reports/so4-002-s1.json']); // s2's report file is missing

  it('pairs by seed id and baseline report path; marks what is missing', () => {
    const seeds = pairRuns(rows, records, (rel) => (present.has(rel) ? { rel } : undefined));
    expect(seeds.map((s) => [s.row.seedId, s.seeded.unavailable ?? 'ok', s.baseline.unavailable ?? 'ok', s.baseline.record?.runId ?? '-'])).toEqual([
      ['p:MO-S01:0', 'ok', 'ok', 'so4-000-p'],
      ['p:MO-S01:1', 'ok', 'ok', 'so4-005-q'], // resolved through reportPathOfRun; rejected later by its status
      ['p:MO-S01:2', 'report reports/so4-003-s2.json of run so4-003-s2 not found', 'ok', 'so4-000-p'],
      ['p:MO-S01:3', 'no seeded run', 'no seeded run', '-'],
    ]);
  });

  it('planScoreCase: copies every record and stored report; names the unusable rows', () => {
    const plan = planScoreCase(rows, records, (rel) => present.has(rel));
    expect(plan.copies).toEqual([
      { from: 'runs/so4-000-p.run.json', to: 'reports/so4-000-p.run.json' }, { from: 'reports/so4-000-p.json', to: 'reports/so4-000-p.json' },
      { from: 'runs/so4-001-s0.run.json', to: 'reports/so4-001-s0.run.json' }, { from: 'reports/so4-001-s0.json', to: 'reports/so4-001-s0.json' },
      { from: 'runs/so4-002-s1.run.json', to: 'reports/so4-002-s1.run.json' }, { from: 'reports/so4-002-s1.json', to: 'reports/so4-002-s1.json' },
      { from: 'runs/so4-003-s2.run.json', to: 'reports/so4-003-s2.run.json' },
      { from: 'runs/so4-005-q.run.json', to: 'reports/so4-005-q.run.json' },
    ]);
    expect(plan.rows).toEqual([
      { seedId: 'p:MO-S01:0', status: 'paired' },
      { seedId: 'p:MO-S01:1', status: 'unusable', reason: 'baseline: run so4-005-q rejected (transport-error)' },
      { seedId: 'p:MO-S01:2', status: 'unusable', reason: 'seeded: report reports/so4-003-s2.json of run so4-003-s2 not found' },
      { seedId: 'p:MO-S01:3', status: 'unusable', reason: 'seeded: no seeded run' },
    ]);
  });

  it('manifestPathOf: one manifest named by every seeded record, else CASE_INPUT_INVALID', () => {
    expect(manifestPathOf(records)).toEqual({ ok: true, value: 'm/manifest.json' });
    expect(manifestPathOf([base])).toEqual({ ok: true, value: undefined });
    const other = record({ seed: { ...seedRef('x', 'y'), manifestPath: 'n/manifest.json' } });
    expect(manifestPathOf([...records, other]).ok).toBe(false);
  });
});

describe('build-score-case CLI on the hand-computed case laid out as harness output (ADR-021 SO4-04)', () => {
  const CASE = join(ROOT, 'tests/fixtures/u5b/hand-computed');
  function io(): { out: string[]; err: string[]; io: { out: (t: string) => void; err: (t: string) => void } } {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, io: { out: (t) => out.push(t), err: (t) => err.push(t) } };
  }
  /** `<tmp>/run`: runs/<runId>.run.json and the reports at their recorded paths, as run-experiment writes them. */
  function harnessLayout(): string {
    const dir = mkdtempSync(join(tmpdir(), 'so4-case-'));
    const run = join(dir, 'run');
    mkdirSync(join(run, 'runs'), { recursive: true });
    cpSync(join(CASE, 'reports'), join(run, 'reports'), { recursive: true });
    for (const f of readdirSync(join(run, 'reports')).filter((n) => n.endsWith('.run.json'))) {
      const rec = JSON.parse(readFileSync(join(run, 'reports', f), 'utf8')) as RunRecord;
      renameSync(join(run, 'reports', f), join(run, 'runs', `${rec.runId}.run.json`));
    }
    return dir;
  }

  it('writes a case whose loaded pairs equal the hand-assembled case; every row paired', () => {
    const dir = harnessLayout();
    const a = io();
    const code = caseMain(['--runs', join(dir, 'run'), '--out', join(dir, 'case'), '--manifest', join(CASE, 'manifest.json')], ROOT, a.io);
    expect(a.err).toEqual([]);
    expect(code).toBe(0);
    expect(a.out.at(-1)).toMatch(/: 4 rows, 4 paired, 0 unusable; 10 files\n$/);
    const built = loadCase(ROOT, join(dir, 'case'));
    const original = loadCase(ROOT, CASE);
    if (!built.ok || !original.ok) throw new Error('case did not load');
    expect(built.value.seeds).toEqual(original.value.seeds);
  });

  it('refuses a non-empty --out and a missing manifest; --self-test exits 1; usage errors exit 2', () => {
    const dir = harnessLayout();
    writeFileSync(join(dir, 'busy'), 'x');
    const a = io();
    expect(caseMain(['--runs', join(dir, 'run'), '--out', dir], ROOT, a.io)).toBe(1);
    expect(a.err.join('')).toContain(CASE_OUT_NOT_EMPTY);
    const b = io();
    // The fixture's seeded records name `manifest.json`, which is not a repository path.
    expect(caseMain(['--runs', join(dir, 'run'), '--out', join(dir, 'c2')], ROOT, b.io)).toBe(1);
    expect(b.err.join('')).toContain(CASE_INPUT_INVALID);
    const c = io();
    expect(caseMain(['--self-test'], ROOT, c.io)).toBe(1);
    expect(c.err.join('')).toContain(`self-test: ${CASE_INPUT_INVALID}`);
    expect(caseMain(['--bogus'], ROOT, io().io)).toBe(2);
    expect(caseMain(['--runs', 'x'], ROOT, io().io)).toBe(2);
  });
});

/**
 * 4 (project, operator) cells of 3 copies on p1 and p2, every copy detected (TP 12, FN 0), and 3 undeclared FF-C04
 * violations (FP-strict 3): cells (p1, MO-S01) TP 3 FP 1; (p1, MO-S02) TP 3 FP 0; (p2, MO-S01) TP 3 FP 1;
 * (p2, MO-S02) TP 3 FP 1. One FP item is labelled TP (labelled FP 2).
 */
async function cellScore(labelled: boolean): Promise<GoldenScoreJson> {
  const fpAt = new Set(['p1:MO-S01:0', 'p2:MO-S01:0', 'p2:MO-S02:1']);
  const seeds = [];
  for (const project of ['p1', 'p2']) {
    for (const op of ['MO-S01', 'MO-S02']) {
      for (let c = 0; c < 3; c++) {
        const id = `${project}:${op}:${String(c)}`;
        const extra: V[] = fpAt.has(id) ? [{ functionId: 'FF-C04', filePath: `src/orphan-${id}.ts` }] : [];
        seeds.push(seed(s01Row(id), await report([]), await report([S01_V, ...extra])));
      }
    }
  }
  const styles = { specStyles: new Map([[SPEC_SHA, 'nestjs']]), corpusStyles: new Map([['p1', 'nestjs' as const], ['p2', 'layered' as const]]) };
  const first = ok(score({ seeds, ...styles }));
  const items = first.perInstance.flatMap((i) => i.fpItems ?? []).map((f) => f.itemId).sort();
  const labels = new Map<string, ReconciledP1Label>(items.map((id, n) => [id, n === 0 ? 'TP' : 'FP']));
  return JSON.parse(canonicalGoldenScore(ok(score({ seeds, ...styles, ...(labelled && { labels }) })))) as GoldenScoreJson;
}

function input(s: GoldenScoreJson, over: Partial<AggregateInput> = {}): AggregateInput {
  return { planId: 'so4-heldout', records: [], reports: new Map(), so5, score: s, resamples: 200, ...over };
}

describe('scored instances carry FP items and styles (ADR-021 SO4-06, SO1-C)', () => {
  it('fpItems name the function, its dimension, tag and template, and the label when labelled; strata gain style-<spec style>', async () => {
    const s = await cellScore(true);
    const i = s.perInstance.find((x) => x.seedId === 'p1:MO-S01:0');
    expect(i?.fpItems).toEqual([expect.objectContaining({ functionId: 'FF-C04', dimension: 'coupling', tag: 'topological', template: 'no-orphan-files' })]);
    expect(s.perInstance.flatMap((x) => (x.fpItems ?? []).map((f) => f.label)).sort()).toEqual(['FP', 'FP', 'TP']);
    expect(i).toMatchObject({ specStyle: 'nestjs', corpusStyle: 'nestjs' });
    expect(strataOf({ split: 'held-out', baseKind: 'corpus', coverage: 'in', specStyle: 'nestjs' })).toContain(JSON.stringify(['held-out', 'style-nestjs', 'all']));
    const overall = new Map(s.overall);
    expect(overall.get(JSON.stringify(['held-out', 'style-nestjs', 'all']))).toEqual(overall.get(HELD_OUT));
    expect(s.denominators.every((d) => d.specStyle === 'nestjs')).toBe(true);
  });
});

describe('aggregate: precision and F1 intervals, coverage, styles (ADR-021 SO4-05, SO4-06, SO1-C)', () => {
  it('held-out total, labelled basis: precision 12/14 with Wilson on 4 cells and on 14 violations; F1 24/26', async () => {
    const out = aggregate(input(await cellScore(true)));
    const csv = parseCsv(out.get('prf_overall.csv') ?? '');
    expect(csv.header.slice(-PRF_INTERVAL_COLUMNS.length)).toEqual([...PRF_INTERVAL_COLUMNS]);
    const ho = csv.rows.find((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    // Wilson(12/14, n = 4) = [0.381187, 0.983177]; Wilson(12, 14) = [0.600586, 0.959906]; F1 = 24 / 26.
    expect(ho).toMatchObject({
      tp: '12', fp_strict: '3', fp_labelled: '2', fn: '0', precision_labelled: '0.857143', f1_labelled: '0.923077',
      precision_f1_ci_basis: 'labelled', precision_ci_low: '0.381187', precision_ci_high: '0.983177', precision_ci_method: 'wilson-cells', precision_n_cells: '4',
      precision_ci_project_method: 'cluster-bootstrap', precision_ci_project_descriptive: 'true',
      precision_ci_independent_low: '0.600586', precision_ci_independent_high: '0.959906', precision_ci_independent_method: 'wilson',
      f1_ci_low: '', f1_ci_method: '', f1_n_cells: '4', f1_ci_project_method: 'cluster-bootstrap', f1_ci_project_descriptive: 'true',
    });
    const style = csv.rows.find((r) => r.split === 'held-out' && r.base_kind === 'style-nestjs');
    expect(style?.precision_ci_low).toBe('0.381187');
  });

  it('strict basis without labels: precision 12/15 = Wilson(0.8, 4 cells) [0.336834, 0.969232]; F1 24/27', async () => {
    const out = aggregate(input(await cellScore(false)));
    const ho = parseCsv(out.get('prf_overall.csv') ?? '').rows.find((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    expect(ho).toMatchObject({
      precision_strict: '0.800000', f1_labelled: '', precision_f1_ci_basis: 'strict',
      precision_ci_low: '0.336834', precision_ci_high: '0.969232', precision_ci_independent_low: '0.548146', precision_ci_independent_high: '0.929525',
    });
  });

  it('per function: FF-S01 precision 1 (Clopper-Pearson on 4 cells, 0.397635; on 12 violations, 0.735352); FF-C04 n = 2 gives counts only', async () => {
    const rows = parseCsv(aggregate(input(await cellScore(true))).get('prf_by_function.csv') ?? '').rows.filter((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    expect(rows.find((r) => r.function_id === 'FF-S01')).toMatchObject({
      tp: '12', fp_labelled: '0', precision_ci_low: '0.397635', precision_ci_high: '1.000000', precision_ci_method: 'clopper-pearson-cells',
      precision_ci_independent_low: '0.735352', precision_ci_independent_method: 'clopper-pearson', f1_ci_project_low: '1.000000', f1_ci_project_high: '1.000000',
    });
    expect(rows.find((r) => r.function_id === 'FF-C04')).toMatchObject({ tp: '0', fp_labelled: '2', precision_f1_ci_basis: 'labelled', precision_ci_low: '', precision_ci_method: '' });
  });

  it('per dimension and tag rows carry the interval columns; FP cells follow the FP function (coupling / topological)', async () => {
    const out = aggregate(input(await cellScore(true)));
    const dims = parseCsv(out.get('prf_by_dimension.csv') ?? '').rows.filter((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    expect(dims.find((r) => r.dimension === 'structural')).toMatchObject({ tp: '12', fp_labelled: '0', precision_ci_method: 'clopper-pearson-cells' });
    expect(dims.find((r) => r.dimension === 'coupling')).toMatchObject({ tp: '0', fp_labelled: '2', precision_f1_ci_basis: 'labelled', precision_ci_method: '' });
    const tags = parseCsv(out.get('prf_by_tag.csv') ?? '').rows.filter((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    expect(tags.find((r) => r.tag === 'topological')).toMatchObject({ fp_labelled: '2', precision_f1_ci_basis: 'labelled' });
  });

  it('an older score without fpItems writes only the basis', async () => {
    const s = await cellScore(true);
    const old = { ...s, perInstance: s.perInstance.map(({ fpItems: _f, ...rest }) => rest) } as GoldenScoreJson;
    const ho = parseCsv(aggregate(input(old)).get('prf_overall.csv') ?? '').rows.find((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    expect(ho).toMatchObject({ precision_f1_ci_basis: 'labelled', precision_ci_low: '', precision_ci_independent_low: '', f1_n_cells: '' });
  });

  it('prf_by_project and denominators carry the corpus and spec styles; coverage and golden N files', async () => {
    const records = [record({ runId: 'r-p1', projectId: 'p1' })];
    const s = await cellScore(true);
    const withRun = { ...s, denominators: [{ ...s.denominators[0], runId: 'r-p1' } as GoldenScoreJson['denominators'][number]] };
    const out = aggregate(input(withRun, { records, corpusStyles: new Map([['p1', 'nestjs'], ['p2', 'layered']]), registeredGoldenN: 85 }));
    const projects = parseCsv(out.get('prf_by_project.csv') ?? '').rows.filter((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    expect(projects.map((r) => [r.project_id, r.corpus_style, r.spec_style, r.precision_f1_ci_basis])).toEqual([['p1', 'nestjs', 'nestjs', 'strict'], ['p2', 'layered', 'nestjs', 'strict']]);
    expect(parseCsv(out.get('denominators.csv') ?? '').rows[0]).toMatchObject({ run_id: 'r-p1', project_id: 'p1', corpus_style: 'nestjs', spec_style: 'nestjs' });
    const coverage = parseCsv(out.get('seed_coverage.csv') ?? '').rows;
    expect(coverage).toHaveLength(12);
    expect(coverage.every((r) => r.stage === 'scored' && r.status === 'matched' && r.golden === 'true')).toBe(true);
    const golden = parseCsv(out.get('golden_instances.csv') ?? '').rows[0];
    expect(golden).toMatchObject({ scope: 'overall', n_golden: '12', n_scored: '12', n_registered: '85', floor_met: 'false', shortfall: '68' });
  });

  it('without a score the coverage files are header-only', () => {
    const out = aggregate({ planId: 'x', records: [], reports: new Map(), so5, resamples: 10 });
    expect(out.get('seed_coverage.csv')?.trim().split('\n')).toHaveLength(1);
    expect(out.get('golden_instances.csv')?.trim().split('\n')).toHaveLength(1);
  });
});
