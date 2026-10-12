/**
 * E1 size analysis (2026-10-10): the SO5 spec-level effect read against project size, from committed E1 aggregate
 * CSVs only (no generation, no evaluation, no judge call). CLI entry: `e1-size-analysis-cli.ts`.
 *
 * Inputs: `so5_grid.csv` and `so5_patterns.csv` of one `aggregate` output (the registered neural aggregation,
 * `results/e1-grid/agg/`) and the E1 plan (`experiments/e1-grid/plan.json`, for the bootstrap and permutation seeds).
 *
 * Every outcome carries a `registration` label:
 * - `registered-primary` / `registered-secondary`: an outcome family of `Docs/analysis-plan.md` §6, recomputed here
 *   with the registered procedure (`so5Tests` of `aggregate.ts`: permutation tests within task × the other factor,
 *   10 000 resamples, Holm within the family of three, descriptive pairwise CIs, Cliff's δ). `reproduces_registered`
 *   says whether the row equals the committed `so5_tests.csv` row. Every secondary family is exploratory (§10 B7).
 * - `registered-descriptive`: an outcome the plan registers as a descriptive column with no test (LOC, all
 *   violations per KLOC, generation and instrument latency, §3). Summaries only; when a test is shown for it, the
 *   test row is labelled `post-hoc`.
 * - `post-hoc`: an outcome or test the plan does not register (findings per file, symbolic findings per family raw
 *   and per KLOC, AHS residualised on log LOC, size correlations). Exploratory, decided after the E1 results were
 *   seen; never confirmatory.
 *
 * The Claude arm (adapter `claude-code-cli`, the 54 registered cells) and the Codex arm (`codex-cli`, ADR-029,
 * exploratory) are analysed apart; the Codex arm has one model, so only its spec-level effect is tested.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { csvText, f6, so5Stratum, stratifiedMeanDiffCi, SO5_TEST_COLUMNS } from './aggregate.js';
import { familyOf, loadSo5Codes } from './lib/so5-codes.js';
import type { So5Codes } from './lib/so5-codes.js';
import { cliffsDelta, holm, permutationFactorTest, permutationInteractionTest } from './lib/stats.js';

// ---------------------------------------------------------------------------------------------
// CSV input

/** Parses RFC-4180-style CSV text (quoted cells with doubled quotes) into header-keyed rows. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  if (header === undefined) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const perKloc = (n: number | undefined, loc: number | undefined): number | undefined => (n === undefined || loc === undefined || !(loc > 0) ? undefined : (n * 1000) / loc);
const perFile = (n: number | undefined, files: number | undefined): number | undefined => (n === undefined || files === undefined || !(files > 0) ? undefined : n / files);
const num = (s: string | undefined): number | undefined => (s === undefined || s === '' ? undefined : Number(s));

// ---------------------------------------------------------------------------------------------
// Cells

/** Symbolic families with at least one finding in E1 (so5_patterns `basis = symbolic`). */
export const SYMBOLIC_FAMILIES = ['FPAT-COUPLING', 'FPAT-PATTERN', 'FPAT-SOLID', 'FPAT-DEP-DIRECTION', 'FPAT-CYCLE', 'FPAT-FRAMEWORK-LEAK', 'FPAT-NAMING', 'FPAT-DATAFLOW'] as const;
export const JUDGE_FAMILIES = ['FPAT-SEMANTIC', 'FPAT-INTEGRITY'] as const;

export interface SizeCell {
  readonly runId: string;
  readonly arm: 'claude' | 'codex';
  readonly model: string;
  readonly specLevel: string;
  readonly taskId: string;
  readonly runIndex: number;
  readonly valid: boolean;
  readonly ahsCombined?: number;
  readonly ahsDeterministic?: number;
  readonly ahsNeuronal?: number;
  readonly files?: number;
  readonly loc?: number;
  readonly violationsDeterministic?: number;
  readonly violationsTotal?: number;
  readonly violationsPerKloc?: number;
  readonly violationsTotalPerKloc?: number;
  readonly generationMs?: number;
  readonly evalTotalMs?: number;
  /** Symbolic findings per family (0 when the cell is valid and has none). */
  readonly symbolic: ReadonlyMap<string, number>;
  /** Failing judge units per family. */
  readonly judge: ReadonlyMap<string, number>;
}

/** The run id that `aggregate` gives a grid row: `e1-grid-<NNN>-<model>_<task>_<level>_run-<i>`, matched by suffix. */
function runSuffix(r: Record<string, string>): string {
  return [r.requested_model_id, r.task_id, r.spec_level, `run-${r.run_index ?? ''}`].map((x) => x ?? '').join('_');
}

export function sizeCells(gridText: string, patternsText: string): SizeCell[] {
  const grid = parseCsv(gridText);
  const patterns = parseCsv(patternsText);
  const bySuffix = new Map<string, Record<string, string>[]>();
  for (const p of patterns) {
    const m = /^e1-grid-\d+-(.+)$/.exec(p.run_id ?? '');
    if (m?.[1] === undefined) continue;
    const list = bySuffix.get(m[1]) ?? [];
    list.push(p);
    bySuffix.set(m[1], list);
  }
  const runIds = new Map<string, string>();
  for (const p of patterns) {
    const m = /^e1-grid-\d+-(.+)$/.exec(p.run_id ?? '');
    if (m?.[1] !== undefined) runIds.set(m[1], p.run_id ?? '');
  }
  return grid.map((r) => {
    const suffix = runSuffix(r);
    const valid = r.status === 'accepted' && r.ahs_deterministic !== '';
    const symbolic = new Map<string, number>();
    const judge = new Map<string, number>();
    if (valid) {
      for (const f of SYMBOLIC_FAMILIES) symbolic.set(f, 0);
      for (const f of JUDGE_FAMILIES) judge.set(f, 0);
    }
    for (const p of bySuffix.get(suffix) ?? []) {
      const n = num(p.count) ?? 0;
      if (p.basis === 'symbolic') symbolic.set(p.code ?? '', (symbolic.get(p.code ?? '') ?? 0) + n);
      if (p.basis === 'judge') judge.set(p.code ?? '', (judge.get(p.code ?? '') ?? 0) + n);
    }
    const opt = <K extends string>(k: K, v: number | undefined): Partial<Record<K, number>> => (v === undefined ? {} : ({ [k]: v } as Record<K, number>));
    return {
      runId: runIds.get(suffix) ?? `e1-grid-${suffix}`,
      arm: r.adapter_id === 'codex-cli' ? 'codex' : 'claude',
      model: r.requested_model_id ?? '',
      specLevel: r.spec_level ?? '',
      taskId: r.task_id ?? '',
      runIndex: num(r.run_index) ?? 0,
      valid,
      ...opt('ahsCombined', valid ? num(r.ahs_combined) : undefined),
      ...opt('ahsDeterministic', valid ? num(r.ahs_deterministic) : undefined),
      ...opt('ahsNeuronal', valid ? num(r.ahs_neuronal) : undefined),
      ...opt('files', num(r.file_count)),
      ...opt('loc', num(r.loc)),
      ...opt('violationsDeterministic', valid ? num(r.violations_deterministic) : undefined),
      ...opt('violationsTotal', valid ? num(r.violations_total) : undefined),
      // Recomputed from the integer counts (as `so5-size.ts` does), not read from the 6-decimal column, so the
      // registered `secondary:violations_per_kloc` rows reproduce to the last printed digit.
      ...opt('violationsPerKloc', valid && r.violations_per_kloc !== '' ? perKloc(num(r.violations_deterministic), num(r.loc)) : undefined),
      ...opt('violationsTotalPerKloc', valid && r.violations_total_per_kloc !== '' ? perKloc(num(r.violations_total), num(r.loc)) : undefined),
      ...opt('generationMs', num(r.generation_ms)),
      ...opt('evalTotalMs', valid ? num(r.eval_total_ms) : undefined),
      symbolic,
      judge,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Outcomes

export type Registration = 'registered-primary' | 'registered-secondary' | 'registered-descriptive' | 'post-hoc';

export interface SizeOutcome {
  readonly name: string;
  /** The registered `so5_tests.csv` family this outcome reproduces, when it is one. */
  readonly registeredFamily?: string;
  readonly registration: Registration;
  /** Whether the permutation tests are run (registered-descriptive outcomes get post-hoc tests only when true). */
  readonly tested: boolean;
  readonly value: (c: SizeCell) => number | undefined;
}


/** Ordinary least squares of y on x: slope and intercept (undefined below 2 distinct x). */
export function ols(x: readonly number[], y: readonly number[]): { slope: number; intercept: number } | undefined {
  const n = x.length;
  if (n < 2 || n !== y.length) return undefined;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0; let sxy = 0;
  for (let i = 0; i < n; i++) { sxx += ((x[i] ?? 0) - mx) ** 2; sxy += ((x[i] ?? 0) - mx) * ((y[i] ?? 0) - my); }
  if (sxx === 0) return undefined;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/**
 * Post-hoc: AHS minus its pooled OLS fit on ln(LOC) over the valid cells of the arm. Size is a consequence of the
 * spec level (a mediator), so this is a direct-effect reading, not a confounder adjustment.
 */
export function residualOnLogLoc(cells: readonly SizeCell[], field: 'ahsCombined' | 'ahsDeterministic'): Map<string, number> {
  const pts = cells.filter((c) => c.valid && c[field] !== undefined && c.loc !== undefined && c.loc > 0);
  const fit = ols(pts.map((c) => Math.log(c.loc ?? 1)), pts.map((c) => c[field] ?? 0));
  const out = new Map<string, number>();
  if (fit === undefined) return out;
  for (const c of pts) out.set(c.runId, (c[field] ?? 0) - (fit.intercept + fit.slope * Math.log(c.loc ?? 1)));
  return out;
}

export function outcomesFor(cells: readonly SizeCell[]): SizeOutcome[] {
  const resid = residualOnLogLoc(cells, 'ahsCombined');
  const residDet = residualOnLogLoc(cells, 'ahsDeterministic');
  const exclPattern = (c: SizeCell): number | undefined => (c.violationsDeterministic === undefined ? undefined : c.violationsDeterministic - (c.symbolic.get('FPAT-PATTERN') ?? 0));
  const symbolicTotal = (c: SizeCell): number | undefined => (c.valid ? [...c.symbolic.values()].reduce((a, b) => a + b, 0) : undefined);
  const out: SizeOutcome[] = [
    { name: 'ahsCombined', registeredFamily: 'primary:ahsCombined', registration: 'registered-primary', tested: true, value: (c) => c.ahsCombined },
    { name: 'ahsDeterministic', registeredFamily: 'co-primary:ahsDeterministic', registration: 'registered-secondary', tested: true, value: (c) => c.ahsDeterministic },
    { name: 'violations_per_kloc', registeredFamily: 'secondary:violations_per_kloc', registration: 'registered-secondary', tested: true, value: (c) => c.violationsPerKloc },
    { name: 'loc', registration: 'registered-descriptive', tested: true, value: (c) => (c.valid ? c.loc : undefined) },
    { name: 'files', registration: 'registered-descriptive', tested: true, value: (c) => (c.valid ? c.files : undefined) },
    { name: 'violations_deterministic', registration: 'registered-descriptive', tested: true, value: (c) => c.violationsDeterministic },
    { name: 'violations_total_per_kloc', registration: 'registered-descriptive', tested: true, value: (c) => c.violationsTotalPerKloc },
    { name: 'generation_ms', registration: 'registered-descriptive', tested: false, value: (c) => (c.valid ? c.generationMs : undefined) },
    { name: 'eval_total_ms', registration: 'registered-descriptive', tested: false, value: (c) => c.evalTotalMs },
    { name: 'violations_deterministic_per_file', registration: 'post-hoc', tested: true, value: (c) => perFile(c.violationsDeterministic, c.files) },
    { name: 'symbolic_findings_total', registration: 'post-hoc', tested: false, value: symbolicTotal },
    // FPAT-PATTERN in E1 is FF-CV05 test-file-pairing only (one finding per untested source file); without it the
    // density no longer counts files.
    { name: 'violations_per_kloc_excl_fpat_pattern', registration: 'post-hoc', tested: true, value: (c) => perKloc(exclPattern(c), c.loc) },
    { name: 'violations_per_file_excl_fpat_pattern', registration: 'post-hoc', tested: true, value: (c) => perFile(exclPattern(c), c.files) },
    { name: 'ahsCombined_resid_lnloc', registration: 'post-hoc', tested: true, value: (c) => resid.get(c.runId) },
    { name: 'ahsDeterministic_resid_lnloc', registration: 'post-hoc', tested: true, value: (c) => residDet.get(c.runId) },
  ];
  for (const f of [...SYMBOLIC_FAMILIES, ...JUDGE_FAMILIES]) {
    const isJudge = (JUDGE_FAMILIES as readonly string[]).includes(f);
    const raw = (c: SizeCell): number | undefined => (c.valid ? (isJudge ? c.judge : c.symbolic).get(f) : undefined);
    const any = cells.some((c) => (raw(c) ?? 0) > 0);
    out.push({ name: `${isJudge ? 'judge' : 'symbolic'}_${f}`, registration: 'post-hoc', tested: any, value: raw });
    out.push({ name: `${isJudge ? 'judge' : 'symbolic'}_${f}_per_kloc`, registration: 'post-hoc', tested: any, value: (c) => perKloc(raw(c), c.loc) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tests (the registered SO5 procedure of `aggregate.ts` `so5Tests`, applied to any outcome)

export const SIZE_TEST_COLUMNS = ['arm', 'outcome', 'registration', 'test_registration', ...SO5_TEST_COLUMNS, 'n', 'reproduces_registered'] as const;

/** The Codex arm is exploratory as a whole (ADR-029): its registered-outcome labels say so. */
const armRegistration = (arm: string, r: Registration): string => (arm === 'codex' && r !== 'post-hoc' ? `${r} (codex arm: exploratory)` : r);

const mean = (x: readonly number[]): number => x.reduce((s, v) => s + v, 0) / x.length;

/**
 * The three tests (model, spec level, interaction) with Holm within the family, then the pairwise rows, exactly as
 * `so5Tests` does. With one model (Codex arm) only the spec-level test and its pairwise rows are produced (family of
 * one).
 */
export function testOutcome(cells: readonly SizeCell[], o: SizeOutcome, seeds: { bootstrap: number; permutation: number }, resamples: number): string[][] {
  const obs = cells.flatMap((c) => {
    const v = o.value(c);
    return v === undefined || !Number.isFinite(v) ? [] : [{ c, v }];
  });
  const models = [...new Set(obs.map((x) => x.c.model))].sort();
  const levels = [...new Set(obs.map((x) => x.c.specLevel))].sort();
  if (levels.length < 2) return [];
  const opts = { seed: seeds.permutation, resamples };
  const tests: { effect: string; r: { statistic: number; p: number } }[] = [];
  if (models.length >= 2) tests.push({ effect: 'model', r: permutationFactorTest(obs.map((x) => ({ block: so5Stratum(x.c.taskId, x.c.specLevel), level: x.c.model, value: x.v })), opts) });
  tests.push({ effect: 'spec-level', r: permutationFactorTest(obs.map((x) => ({ block: so5Stratum(x.c.taskId, x.c.model), level: x.c.specLevel, value: x.v })), opts) });
  if (models.length >= 2) tests.push({ effect: 'model×spec-level', r: permutationInteractionTest(obs.map((x) => ({ block: x.c.taskId, a: x.c.model, b: x.c.specLevel, value: x.v })), opts) });
  const adjusted = holm(tests.map((t) => t.r.p));
  const confirmatory = o.registration === 'registered-primary' ? ['model', 'spec-level', 'model×spec-level'] : o.registeredFamily?.startsWith('co-primary') === true ? ['model'] : [];
  const family = o.registeredFamily ?? `post-hoc:${o.name}`;
  const rows: string[][] = [];
  tests.forEach((t, i) => rows.push([t.effect, f6(t.r.statistic), f6(t.r.p), f6(adjusted[i]), family, '', '', '', '', String(!confirmatory.includes(t.effect)), 'false', String(obs.length)]));
  const factors: [string, string[], (c: SizeCell) => string][] = [['spec-level', levels, (c) => c.specLevel]];
  if (models.length >= 2) factors.unshift(['model', models, (c) => c.model]);
  for (const [factor, list, key] of factors) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i] ?? '';
        const b = list[j] ?? '';
        const xa = obs.filter((x) => key(x.c) === a).map((x) => x.v);
        const xb = obs.filter((x) => key(x.c) === b).map((x) => x.v);
        if (xa.length === 0 || xb.length === 0) continue;
        const pair = obs.filter((x) => key(x.c) === a || key(x.c) === b).map((x) => ({
          cell: JSON.stringify([x.c.model, x.c.specLevel, x.c.taskId]), group: key(x.c) === a ? 'A' as const : 'B' as const, value: x.v,
        }));
        const [lo, hi] = stratifiedMeanDiffCi(pair, seeds.bootstrap, resamples);
        rows.push([`${factor}:${a}-${b}`, '', '', '', family, f6(mean(xa) - mean(xb)), f6(lo), f6(hi), f6(cliffsDelta(xa, xb)), String(!confirmatory.includes(factor)), 'true', String(xa.length + xb.length)]);
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Descriptives

export function pearson(x: readonly number[], y: readonly number[]): number | undefined {
  const n = x.length;
  if (n < 3) return undefined;
  const mx = mean(x); const my = mean(y);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (x[i] ?? 0) - mx; const dy = (y[i] ?? 0) - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? undefined : sxy / Math.sqrt(sxx * syy);
}

/** Average ranks (ties share the mean rank). */
export function ranks(x: readonly number[]): number[] {
  const idx = x.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const r = new Array<number>(x.length).fill(0);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]?.v === idx[i]?.v) j++;
    for (let k = i; k <= j; k++) r[idx[k]?.i ?? 0] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

export const spearman = (x: readonly number[], y: readonly number[]): number | undefined => pearson(ranks(x), ranks(y));

const median = (x: readonly number[]): number | undefined => {
  if (x.length === 0) return undefined;
  const s = [...x].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

const CELL_COLUMNS = [
  'run_id', 'arm', 'model', 'spec_level', 'task_id', 'run_index', 'valid', 'ahs_combined', 'ahs_deterministic', 'ahs_neuronal',
  'files', 'loc', 'violations_deterministic', 'violations_total', 'violations_per_kloc', 'violations_total_per_kloc',
  'violations_deterministic_per_file', 'ahs_combined_resid_lnloc', 'generation_ms', 'eval_total_ms',
  ...SYMBOLIC_FAMILIES.flatMap((f) => [`sym_${f}`, `sym_${f}_per_kloc`]), ...JUDGE_FAMILIES.map((f) => `judge_${f}`),
] as const;

function cellRows(cells: readonly SizeCell[]): string[][] {
  const resid = new Map([...residualOnLogLoc(cells.filter((c) => c.arm === 'claude'), 'ahsCombined'), ...residualOnLogLoc(cells.filter((c) => c.arm === 'codex'), 'ahsCombined')]);
  const n = (x: number | undefined): string => (x === undefined ? '' : Number.isInteger(x) ? String(x) : f6(x));
  return cells.map((c) => [
    c.runId, c.arm, c.model, c.specLevel, c.taskId, String(c.runIndex), String(c.valid), f6(c.ahsCombined), f6(c.ahsDeterministic), f6(c.ahsNeuronal),
    n(c.files), n(c.loc), n(c.violationsDeterministic), n(c.violationsTotal), f6(c.violationsPerKloc), f6(c.violationsTotalPerKloc),
    f6(perFile(c.violationsDeterministic, c.files)), f6(resid.get(c.runId)), n(c.generationMs), n(c.evalTotalMs),
    ...SYMBOLIC_FAMILIES.flatMap((f) => [n(c.valid ? c.symbolic.get(f) : undefined), f6(c.valid ? perKloc(c.symbolic.get(f), c.loc) : undefined)]),
    ...JUDGE_FAMILIES.map((f) => n(c.valid ? c.judge.get(f) : undefined)),
  ]);
}

export const LEVEL_COLUMNS = ['arm', 'grouping', 'model', 'spec_level', 'outcome', 'registration', 'n_valid', 'n_coordinates', 'mean', 'median', 'sd', 'min', 'max'] as const;

function levelRows(cells: readonly SizeCell[], arm: string, outcomes: readonly SizeOutcome[]): string[][] {
  const rows: string[][] = [];
  const groupings: [string, (c: SizeCell) => [string, string]][] = [
    ['all', () => ['', '']], ['model', (c) => [c.model, '']], ['spec-level', (c) => ['', c.specLevel]], ['model×spec-level', (c) => [c.model, c.specLevel]],
  ];
  for (const [g, key] of groupings) {
    const groups = new Map<string, SizeCell[]>();
    for (const c of cells) {
      const k = JSON.stringify(key(c));
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    for (const k of [...groups.keys()].sort()) {
      const [m, s] = JSON.parse(k) as [string, string];
      const gc = groups.get(k) ?? [];
      for (const o of outcomes) {
        const v = gc.flatMap((c) => { const x = o.value(c); return x === undefined || !Number.isFinite(x) ? [] : [x]; });
        const mu = v.length === 0 ? undefined : mean(v);
        const sd = v.length < 2 || mu === undefined ? undefined : Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1));
        rows.push([arm, g, m, s, o.name, armRegistration(arm, o.registration), String(v.length), String(gc.length), f6(mu), f6(median(v)), f6(sd), f6(v.length === 0 ? undefined : Math.min(...v)), f6(v.length === 0 ? undefined : Math.max(...v))]);
      }
    }
  }
  return rows;
}

export const FAMILY_COLUMNS = ['arm', 'spec_level', 'family', 'basis', 'n_valid', 'findings_sum', 'findings_mean', 'share_of_findings', 'per_kloc_pooled', 'per_kloc_mean', 'cells_with_finding'] as const;

function familyRows(cells: readonly SizeCell[], arm: string): string[][] {
  const rows: string[][] = [];
  const valid = cells.filter((c) => c.valid);
  const levels = ['', ...[...new Set(valid.map((c) => c.specLevel))].sort()];
  for (const s of levels) {
    const gc = valid.filter((c) => s === '' || c.specLevel === s);
    const locSum = gc.reduce((a, c) => a + (c.loc ?? 0), 0);
    const totalSym = gc.reduce((a, c) => a + [...c.symbolic.values()].reduce((x, y) => x + y, 0), 0);
    for (const [basis, fams] of [['symbolic', SYMBOLIC_FAMILIES], ['judge', JUDGE_FAMILIES]] as const) {
      for (const f of fams) {
        const counts = gc.map((c) => (basis === 'symbolic' ? c.symbolic : c.judge).get(f) ?? 0);
        const sum = counts.reduce((a, b) => a + b, 0);
        const pk = gc.flatMap((c, i) => { const x = perKloc(counts[i], c.loc); return x === undefined ? [] : [x]; });
        rows.push([
          arm, s === '' ? 'all' : s, f, basis, String(gc.length), String(sum), f6(gc.length === 0 ? undefined : sum / gc.length),
          basis === 'symbolic' ? f6(totalSym === 0 ? undefined : sum / totalSym) : '', f6(locSum === 0 ? undefined : (sum * 1000) / locSum),
          f6(pk.length === 0 ? undefined : mean(pk)), String(counts.filter((x) => x > 0).length),
        ]);
      }
    }
  }
  return rows;
}

export const CORRELATION_COLUMNS = ['arm', 'subset', 'x', 'y', 'n', 'pearson', 'spearman', 'registration'] as const;

function correlationRows(cells: readonly SizeCell[], arm: string): string[][] {
  const rows: string[][] = [];
  const valid = cells.filter((c) => c.valid);
  const subsets: [string, SizeCell[]][] = [['all', valid]];
  for (const s of [...new Set(valid.map((c) => c.specLevel))].sort()) subsets.push([`spec-level=${s}`, valid.filter((c) => c.specLevel === s)]);
  for (const m of [...new Set(valid.map((c) => c.model))].sort()) subsets.push([`model=${m}`, valid.filter((c) => c.model === m)]);
  const xs: [string, (c: SizeCell) => number | undefined][] = [['files', (c) => c.files], ['loc', (c) => c.loc], ['ln_loc', (c) => (c.loc === undefined || c.loc <= 0 ? undefined : Math.log(c.loc))]];
  const ys: [string, (c: SizeCell) => number | undefined][] = [
    ['ahs_combined', (c) => c.ahsCombined], ['ahs_deterministic', (c) => c.ahsDeterministic], ['violations_deterministic', (c) => c.violationsDeterministic], ['violations_per_kloc', (c) => c.violationsPerKloc],
  ];
  for (const [sname, sc] of subsets) {
    for (const [xn, xf] of xs) {
      for (const [yn, yf] of ys) {
        const pts = sc.flatMap((c) => { const x = xf(c); const y = yf(c); return x === undefined || y === undefined ? [] : [[x, y] as const]; });
        rows.push([arm, sname, xn, yn, String(pts.length), f6(pearson(pts.map((p) => p[0]), pts.map((p) => p[1]))), f6(spearman(pts.map((p) => p[0]), pts.map((p) => p[1]))), 'post-hoc-descriptive']);
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Function-level decomposition (post hoc; from the committed evaluation reports)

/** The parts of a committed evaluation report this analysis reads. */
export interface ReportLike {
  readonly ahsCombined?: number;
  readonly perDimensionScores: readonly { readonly dimension: string; readonly avr: number; readonly effectiveWeight: number; readonly functionCount: number }[];
  readonly functionResults: readonly { readonly functionId: string; readonly name: string; readonly dimension: string; readonly route: string; readonly passed: boolean; readonly violationCount: number }[];
}

export const FUNCTION_COLUMNS = [
  'arm', 'spec_level', 'function_id', 'name', 'dimension', 'family', 'n_valid', 'cells_fired', 'fire_rate', 'findings_sum', 'findings_mean',
  'findings_per_file_pooled', 'findings_per_kloc_pooled', 'ahs_deficit_mean', 'mean_files_when_fired', 'mean_files_when_not_fired',
] as const;

export const DIMENSION_DEFICIT_COLUMNS = ['arm', 'spec_level', 'dimension', 'n_valid', 'avr_mean', 'effective_weight', 'ahs_deficit_mean'] as const;

/**
 * Per (arm, spec level, function): how often the function fires, its findings raw, per file and per KLOC, and its
 * mean contribution to the AHS deficit 1 − ahsCombined. A dimension's AVR is violatedWeight ÷ functionCount
 * (binary per function), so a fired symbolic function costs effectiveWeight ÷ functionCount of AHS however many
 * findings it has; the contributions of the fired functions and the judge dimensions add up to the deficit.
 */
export function functionRows(cells: readonly SizeCell[], reports: ReadonlyMap<string, ReportLike>, codes: So5Codes): { functions: string[][]; dimensions: string[][] } {
  const functions: string[][] = [];
  const dimensions: string[][] = [];
  for (const arm of ['claude', 'codex'] as const) {
    const valid = cells.filter((c) => c.arm === arm && c.valid && reports.has(c.runId));
    for (const s of ['', ...[...new Set(valid.map((c) => c.specLevel))].sort()]) {
      const gc = valid.filter((c) => s === '' || c.specLevel === s);
      const fileSum = gc.reduce((a, c) => a + (c.files ?? 0), 0);
      const locSum = gc.reduce((a, c) => a + (c.loc ?? 0), 0);
      const ids = new Map<string, { name: string; dimension: string }>();
      for (const c of gc) for (const f of reports.get(c.runId)?.functionResults ?? []) if (f.route === 'symbolic') ids.set(f.functionId, { name: f.name, dimension: f.dimension });
      for (const id of [...ids.keys()].sort()) {
        const meta = ids.get(id) ?? { name: '', dimension: '' };
        let fired = 0; let sum = 0; let deficit = 0;
        const filesFired: number[] = []; const filesNot: number[] = [];
        for (const c of gc) {
          const r = reports.get(c.runId);
          const f = r?.functionResults.find((x) => x.functionId === id);
          const d = r?.perDimensionScores.find((x) => x.dimension === meta.dimension);
          const isFired = f !== undefined && !f.passed;
          if (isFired) {
            fired++;
            sum += f.violationCount;
            if (d !== undefined && d.functionCount > 0) deficit += d.effectiveWeight / d.functionCount;
            filesFired.push(c.files ?? 0);
          } else filesNot.push(c.files ?? 0);
        }
        const n = gc.length;
        functions.push([
          arm, s === '' ? 'all' : s, id, meta.name, meta.dimension, familyOf(codes, meta.name) ?? familyOf(codes, id) ?? '', String(n), String(fired),
          f6(n === 0 ? undefined : fired / n), String(sum), f6(n === 0 ? undefined : sum / n), f6(fileSum === 0 ? undefined : sum / fileSum),
          f6(locSum === 0 ? undefined : (sum * 1000) / locSum), f6(n === 0 ? undefined : deficit / n),
          f6(filesFired.length === 0 ? undefined : mean(filesFired)), f6(filesNot.length === 0 ? undefined : mean(filesNot)),
        ]);
      }
      const dims = [...new Set(gc.flatMap((c) => (reports.get(c.runId)?.perDimensionScores ?? []).map((d) => d.dimension)))];
      for (const dim of dims) {
        const ds = gc.flatMap((c) => { const d = reports.get(c.runId)?.perDimensionScores.find((x) => x.dimension === dim); return d === undefined ? [] : [d]; });
        dimensions.push([
          arm, s === '' ? 'all' : s, dim, String(ds.length), f6(ds.length === 0 ? undefined : mean(ds.map((d) => d.avr))),
          f6(ds[0]?.effectiveWeight), f6(ds.length === 0 ? undefined : mean(ds.map((d) => d.avr * d.effectiveWeight))),
        ]);
      }
    }
  }
  return { functions, dimensions };
}

// ---------------------------------------------------------------------------------------------
// Entry

export interface SizeAnalysisInput {
  readonly gridText: string;
  readonly patternsText: string;
  /** The committed `so5_tests.csv`, for the reproduction check. */
  readonly testsText: string;
  readonly seeds: { readonly bootstrap: number; readonly permutation: number };
  readonly resamples: number;
  /** Committed evaluation reports by run id, and the SO5 codes, for the function-level files (optional). */
  readonly reports?: ReadonlyMap<string, ReportLike>;
  readonly codes?: So5Codes;
}

export function sizeAnalysis(input: SizeAnalysisInput): Map<string, string> {
  const cells = sizeCells(input.gridText, input.patternsText);
  const registered = parseCsv(input.testsText);
  const registeredKey = (r: readonly string[]): string => JSON.stringify(r.slice(0, SO5_TEST_COLUMNS.length));
  const registeredRows = new Set(registered.map((r) => registeredKey(SO5_TEST_COLUMNS.map((c) => r[c] ?? ''))));
  const testRows: string[][] = [];
  const levels: string[][] = [];
  const families: string[][] = [];
  const correlations: string[][] = [];
  for (const arm of ['claude', 'codex'] as const) {
    const armCells = cells.filter((c) => c.arm === arm);
    const outcomes = outcomesFor(armCells);
    levels.push(...levelRows(armCells, arm, outcomes));
    families.push(...familyRows(armCells, arm));
    correlations.push(...correlationRows(armCells, arm));
    for (const o of outcomes) {
      if (!o.tested) continue;
      const testReg = arm === 'claude' && (o.registration === 'registered-primary' || o.registration === 'registered-secondary') ? o.registration : 'post-hoc';
      for (const r of testOutcome(armCells, o, input.seeds, input.resamples)) {
        const so5 = r.slice(0, SO5_TEST_COLUMNS.length);
        const reproduces = testReg === 'post-hoc' ? '' : String(registeredRows.has(registeredKey(so5)));
        testRows.push([arm, o.name, armRegistration(arm, o.registration), testReg, ...so5, r[SO5_TEST_COLUMNS.length] ?? '', reproduces]);
      }
    }
  }
  const extra: [string, string][] = [];
  if (input.reports !== undefined && input.codes !== undefined) {
    const fr = functionRows(cells, input.reports, input.codes);
    extra.push(['size_functions.csv', csvText(FUNCTION_COLUMNS, fr.functions)], ['size_dimensions.csv', csvText(DIMENSION_DEFICIT_COLUMNS, fr.dimensions)]);
  }
  return new Map([
    ['size_cells.csv', csvText(CELL_COLUMNS, cellRows(cells))],
    ['size_levels.csv', csvText(LEVEL_COLUMNS, levels)],
    ['size_tests.csv', csvText(SIZE_TEST_COLUMNS, testRows)],
    ['size_families.csv', csvText(FAMILY_COLUMNS, families)],
    ['size_correlations.csv', csvText(CORRELATION_COLUMNS, correlations)],
    ...extra,
  ]);
}

export interface SizeMainIo {
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
  readonly writeFile: (file: string, text: string) => void;
}

/**
 * `--agg <dir> --plan <plan.json> --out <dir> [--reports <dir>] [--resamples N]`; exit 0 on success, 2 on bad
 * arguments. `--reports` is the committed report directory (`<runId>.json`), for the function-level files.
 */
export function main(argv: readonly string[], repoRoot: string, io: SizeMainIo): number {
  const arg = (k: string): string | undefined => { const i = argv.indexOf(k); return i < 0 ? undefined : argv[i + 1]; };
  const agg = arg('--agg');
  const planFile = arg('--plan');
  const out = arg('--out');
  if (agg === undefined || planFile === undefined || out === undefined) {
    io.err('usage: e1-size-analysis-cli.ts --agg <dir> --plan <plan.json> --out <dir> [--resamples N]\n');
    return 2;
  }
  const plan = JSON.parse(readFileSync(join(repoRoot, planFile), 'utf8')) as { seeds?: { bootstrap: number; permutation: number } };
  if (plan.seeds === undefined) { io.err('plan has no seeds\n'); return 2; }
  const read = (f: string): string => readFileSync(join(repoRoot, agg, f), 'utf8');
  const reportsDir = arg('--reports');
  const files = sizeAnalysis({
    gridText: read('so5_grid.csv'), patternsText: read('so5_patterns.csv'), testsText: read('so5_tests.csv'),
    seeds: plan.seeds, resamples: Number(arg('--resamples') ?? '10000'),
    ...(reportsDir === undefined ? {} : { reports: readReports(join(repoRoot, reportsDir)), codes: so5CodesOrThrow(repoRoot) }),
  });
  for (const [name, text] of files) io.writeFile(join(repoRoot, out, name), text);
  io.out(`wrote ${String(files.size)} files to ${out}\n`);
  return 0;
}

function readReports(dir: string): Map<string, ReportLike> {
  const out = new Map<string, ReportLike>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) out.set(f.slice(0, -'.json'.length), JSON.parse(readFileSync(join(dir, f), 'utf8')) as ReportLike);
  return out;
}

function so5CodesOrThrow(repoRoot: string): So5Codes {
  const l = loadSo5Codes(repoRoot);
  if (!l.ok) throw new Error(`SO5 codes: ${l.detail}`);
  return l.codes;
}
