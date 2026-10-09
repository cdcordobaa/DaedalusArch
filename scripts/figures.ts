/**
 * Thesis figures for Ch7–9 (ADR-021 X-5; FR-36; BR-U5b-60, 61, 72; ADR-020 items 1, 6, 7; `Docs/threats-to-validity.md`).
 *
 * The CSV set written by `scripts/aggregate.ts` is the canonical result; figures are derived from it and carry no
 * number of their own. Each figure is a typed `FigureDef`: its source CSV, the columns it needs (the aggregate.ts
 * headers; a test checks them against `aggregate()` output), its caption, and a pure `prepare` rule that turns CSV
 * rows into the plotted rows. Its Vega-Lite spec is `scripts/lib/figures/thesis/<id>.vl.json`, which reads only the
 * prepared rows. These specs live outside `scripts/lib/figures/` top level on purpose: `aggregate`'s `drawFigures`
 * renders every top-level spec over raw CSV text, while these need the prepare rule and a schema check first.
 *
 * Rules (each unit-tested with hand-computed fixtures in `tests/unit/scripts/u6/figures.test.ts`):
 * - FIG-01 schema: a source CSV must carry every required column, or the figure fails `FIG_CSV_SCHEMA`.
 * - FIG-02 SO4 P/R/F1: rows of the chosen split with `base_kind` and `coverage` both `all`. Precision is "seeded
 *   differential precision" (ADR-020 item 1): `precision_labelled` when present, else `precision_strict`, with its
 *   basis. Recall carries `ci_low` / `ci_high` (BR-U5b-61). F1 is `f1_labelled` when present, else 2PR / (P + R) on
 *   the strict basis (0 when P + R = 0). Precision and F1 intervals are drawn only when the CSV carries
 *   `precision_ci_low` / `_high` or `f1_ci_low` / `_high` (SO4-06 adds them); nothing is invented.
 * - FIG-03 SO5 grid: a cell is valid when `status` is `accepted` and the outcome is a number. Two outcomes are
 *   plotted side by side (ADR-020 item 7, co-primary): the verdict-source AHS (the column named by `verdict_source`)
 *   and `ahs_deterministic`. Each model × spec-level cell shows its mean over valid runs and `n valid / n cells`
 *   (TV-30: selection on generation success stays visible). Spec levels follow `SPEC_LEVELS`.
 * - FIG-04 SO5 interaction: one row per valid run and outcome; the spec draws the per-model mean line over spec level.
 * - FIG-05 SO2 latency: one row per run (the first `latency.csv` row of each `run_id`), seconds, and
 *   `over_budget` = `cycle_query_ms` > `LATENCY_GATE_MS` (30 s, ADR-016 e).
 * - FIG-06 SO2 coverage: parse coverage per run, and each import-outcome count as a share of the six outcome counts
 *   (no share when they sum to 0).
 * - FIG-07 threshold sweep: every row must have `purpose` = `sensitivity-only`, or the figure fails
 *   `FIG_SENSITIVITY_PURPOSE` (BR-U5b-60). The caption says "sensitivity-only, not tuning".
 *
 * A figure whose CSV is absent, or whose prepared rows are empty (a header-only CSV), is skipped and reported, never
 * drawn empty. Rendering reuses `renderSvgValues` (vega `renderer: 'none'`, byte-identical for the same input), so
 * the CLI runs under tsx (ESM), like `aggregate-cli.ts` (OI-U5b-P2-2).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseCsv, renderSvgValues } from './lib/figures/draw.js';
import { SPEC_LEVELS } from './lib/generators/types.js';
import { LATENCY_GATE_MS } from './run-experiment.js';

export const THESIS_FIGURES_DIR = 'scripts/lib/figures/thesis';
export const FIG_CSV_SCHEMA = 'FIG_CSV_SCHEMA';
export const FIG_VALUE_INVALID = 'FIG_VALUE_INVALID';
export const FIG_SENSITIVITY_PURPOSE = 'FIG_SENSITIVITY_PURPOSE';
export const FIG_SPEC_MISSING = 'FIG_SPEC_MISSING';
export const SENSITIVITY_CAPTION = 'sensitivity-only, not tuning';
export const CAPTION_WIDTH = 90;

export type FigureCell = string | number | boolean | null;
export type FigureRow = Readonly<Record<string, FigureCell>>;
export interface CsvTable { readonly header: readonly string[]; readonly rows: readonly Readonly<Record<string, string>>[] }
export interface FigureOptions { readonly split: string }
export const DEFAULT_FIGURE_OPTIONS: FigureOptions = { split: 'held-out' };

export interface FigureDef {
  readonly id: string;
  readonly csv: string;
  readonly svg: string;
  readonly objective: 'SO2' | 'SO4' | 'SO5' | 'SO4/SO5';
  /** Thesis section key of `Docs/threats-to-validity.md` §1. */
  readonly section: string;
  readonly title: string;
  readonly caption: string;
  readonly requiredColumns: readonly string[];
  readonly prepare: (table: CsvTable, options: FigureOptions) => FigureRow[];
}

export class FigureError extends Error {
  constructor(readonly code: string, detail: string) {
    super(`${code}: ${detail}`);
  }
}

export type PrepareResult = { readonly ok: true; readonly rows: FigureRow[] } | { readonly ok: false; readonly code: string; readonly detail: string };

// ---------------------------------------------------------------------------------------------
// Cell readers

/** '' → null; a finite number → it; anything else → `FIG_VALUE_INVALID`. */
export function num(row: Readonly<Record<string, string>>, column: string): number | null {
  const v = row[column] ?? '';
  if (v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new FigureError(FIG_VALUE_INVALID, `column ${column} holds ${JSON.stringify(v)}, not a number`);
  return n;
}

/** FIG-01: the required columns missing from a header, in the order they are required. */
export function missingColumns(header: readonly string[], required: readonly string[]): string[] {
  const have = new Set(header);
  return required.filter((c) => !have.has(c));
}

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---------------------------------------------------------------------------------------------
// FIG-02 SO4 P/R/F1

const PRF_REQUIRED = [
  'split', 'base_kind', 'coverage', 'tp', 'fn', 'precision_strict', 'precision_labelled', 'recall', 'f1_labelled', 'ci_low',
  'ci_high', 'ci_method',
] as const;
export const SO4_METRICS = ['seeded differential precision', 'recall', 'F1'] as const;

function optionalInterval(header: readonly string[], row: Readonly<Record<string, string>>, prefix: string): [number | null, number | null] {
  const lo = `${prefix}_ci_low`;
  const hi = `${prefix}_ci_high`;
  if (!header.includes(lo) || !header.includes(hi)) return [null, null];
  return [num(row, lo), num(row, hi)];
}

/** FIG-02 for `prf_by_function.csv` (group `function_id`) or `prf_by_tag.csv` (group `tag`, plus `sub_row`). */
export function prepareSo4Prf(table: CsvTable, options: FigureOptions, group: 'function_id' | 'tag'): FigureRow[] {
  const out: FigureRow[] = [];
  for (const r of table.rows) {
    if (r.split !== options.split || r.base_kind !== 'all' || r.coverage !== 'all') continue;
    const label = group === 'tag' && (r.sub_row ?? '') !== '' ? `${r.tag ?? ''}/${r.sub_row ?? ''}` : r[group] ?? '';
    const nSeeded = (num(r, 'tp') ?? 0) + (num(r, 'fn') ?? 0);
    const pLab = num(r, 'precision_labelled');
    const pStrict = num(r, 'precision_strict');
    const p = pLab ?? pStrict;
    const pBasis = pLab !== null ? 'labelled' : 'strict';
    const rec = num(r, 'recall');
    const fLab = num(r, 'f1_labelled');
    const f = fLab ?? (pStrict !== null && rec !== null ? (pStrict + rec === 0 ? 0 : round6((2 * pStrict * rec) / (pStrict + rec))) : null);
    const fBasis = fLab !== null ? 'labelled' : 'strict';
    const [pLo, pHi] = optionalInterval(table.header, r, 'precision');
    const [fLo, fHi] = optionalInterval(table.header, r, 'f1');
    const cand: [string, number | null, string, number | null, number | null, string][] = [
      ['seeded differential precision', p, pBasis, pLo, pHi, pLo === null ? '' : 'csv'],
      ['recall', rec, 'strict', num(r, 'ci_low'), num(r, 'ci_high'), r.ci_method ?? ''],
      ['F1', f, fBasis, fLo, fHi, fLo === null ? '' : 'csv'],
    ];
    for (const [metric, value, basis, ciLow, ciHigh, ciMethod] of cand) {
      if (value === null) continue;
      out.push({ group: label, metric, value, basis, ci_low: ciLow, ci_high: ciHigh, ci_method: ciMethod, n_seeded: nSeeded });
    }
  }
  const order = (m: FigureCell | undefined): number => SO4_METRICS.indexOf(m as (typeof SO4_METRICS)[number]);
  return out.sort((a, b) => (String(a.group) < String(b.group) ? -1 : String(a.group) > String(b.group) ? 1 : order(a.metric) - order(b.metric)));
}

// ---------------------------------------------------------------------------------------------
// FIG-03 / FIG-04 SO5

const SO5_REQUIRED = ['requested_model_id', 'spec_level', 'task_id', 'run_index', 'status', 'verdict_source', 'ahs_deterministic', 'ahs_combined', 'ahs_neuronal'] as const;
export const SO5_OUTCOMES = ['verdict-source AHS', 'ahsDeterministic'] as const;
const VERDICT_SOURCE_COLUMN: Readonly<Record<string, string>> = {
  ahsCombined: 'ahs_combined', ahsNeuronal: 'ahs_neuronal', ahsDeterministic: 'ahs_deterministic',
};

/** The outcome value of one grid row, or null when the cell is not valid for it (FIG-03). */
export function so5Outcome(row: Readonly<Record<string, string>>, outcome: (typeof SO5_OUTCOMES)[number]): number | null {
  if (row.status !== 'accepted') return null;
  if (outcome === 'ahsDeterministic') return num(row, 'ahs_deterministic');
  const col = VERDICT_SOURCE_COLUMN[row.verdict_source ?? ''];
  if (col === undefined) throw new FigureError(FIG_VALUE_INVALID, `accepted row has verdict_source ${JSON.stringify(row.verdict_source ?? '')}`);
  return num(row, col);
}

export function specLevelOrder(level: string): number {
  const i = (SPEC_LEVELS as readonly string[]).indexOf(level);
  return i === -1 ? SPEC_LEVELS.length : i;
}

const byModelLevel = (a: FigureRow, b: FigureRow): number =>
  String(a.outcome) !== String(b.outcome) ? SO5_OUTCOMES.indexOf(a.outcome as (typeof SO5_OUTCOMES)[number]) - SO5_OUTCOMES.indexOf(b.outcome as (typeof SO5_OUTCOMES)[number])
    : String(a.model) !== String(b.model) ? (String(a.model) < String(b.model) ? -1 : 1)
      : Number(a.spec_level_order) !== Number(b.spec_level_order) ? Number(a.spec_level_order) - Number(b.spec_level_order)
        : String(a.spec_level) < String(b.spec_level) ? -1 : String(a.spec_level) > String(b.spec_level) ? 1 : 0;

/** FIG-03: one row per outcome × model × spec level with the mean over valid runs and the counts. */
export function prepareSo5Heatmap(table: CsvTable): FigureRow[] {
  const cells = new Map<string, { model: string; level: string; outcome: (typeof SO5_OUTCOMES)[number]; values: number[]; n: number }>();
  for (const r of table.rows) {
    for (const outcome of SO5_OUTCOMES) {
      const key = JSON.stringify([outcome, r.requested_model_id ?? '', r.spec_level ?? '']);
      const c = cells.get(key) ?? { model: r.requested_model_id ?? '', level: r.spec_level ?? '', outcome, values: [], n: 0 };
      c.n += 1;
      const v = so5Outcome(r, outcome);
      if (v !== null) c.values.push(v);
      cells.set(key, c);
    }
  }
  return [...cells.values()].map((c) => {
    const m = c.values.length === 0 ? null : round6(mean(c.values));
    return {
      outcome: c.outcome, model: c.model, spec_level: c.level, spec_level_order: specLevelOrder(c.level), mean: m,
      n_valid: c.values.length, n_cells: c.n, label: `${m === null ? 'n/a' : m.toFixed(3)} (${String(c.values.length)}/${String(c.n)})`,
    };
  }).sort(byModelLevel);
}

/** FIG-04: one row per valid run and outcome. */
export function prepareSo5Interaction(table: CsvTable): FigureRow[] {
  const out: FigureRow[] = [];
  for (const r of table.rows) {
    for (const outcome of SO5_OUTCOMES) {
      const v = so5Outcome(r, outcome);
      if (v === null) continue;
      out.push({
        outcome, model: r.requested_model_id ?? '', spec_level: r.spec_level ?? '', spec_level_order: specLevelOrder(r.spec_level ?? ''),
        task_id: r.task_id ?? '', run_index: num(r, 'run_index'), value: v,
      });
    }
  }
  return out.sort((a, b) => byModelLevel(a, b) || (String(a.task_id) < String(b.task_id) ? -1 : String(a.task_id) > String(b.task_id) ? 1 : Number(a.run_index) - Number(b.run_index)));
}

// ---------------------------------------------------------------------------------------------
// FIG-05 / FIG-06 SO2

const LATENCY_REQUIRED = ['run_id', 'project_id', 'file_count', 'total_ms', 'cycle_query_ms', 'gate_result'] as const;
const COVERAGE_REQUIRED = [
  'run_id', 'parse_coverage', 'resolved_internal', 'external', 'external_out_of_root_alias', 'unresolved', 'dropped_no_file_node',
  'unsupported_dynamic',
] as const;
export const IMPORT_OUTCOMES = COVERAGE_REQUIRED.slice(2);

/** FIG-05: one row per run. */
export function prepareLatency(table: CsvTable): FigureRow[] {
  const seen = new Set<string>();
  const out: FigureRow[] = [];
  for (const r of table.rows) {
    const id = r.run_id ?? '';
    if (seen.has(id)) continue;
    seen.add(id);
    const total = num(r, 'total_ms');
    const cycle = num(r, 'cycle_query_ms');
    out.push({
      run_id: id, project_id: r.project_id ?? '', file_count: num(r, 'file_count'), total_s: total === null ? null : total / 1000,
      cycle_query_s: cycle === null ? null : cycle / 1000, gate_s: LATENCY_GATE_MS / 1000, gate_result: r.gate_result ?? '',
      over_budget: cycle !== null && cycle > LATENCY_GATE_MS,
    });
  }
  return out;
}

/** FIG-06: a `parse` row per run, and an `import` row per non-empty outcome share. */
export function prepareCoverage(table: CsvTable): FigureRow[] {
  const out: FigureRow[] = [];
  for (const r of table.rows) {
    const id = r.run_id ?? '';
    const parse = num(r, 'parse_coverage');
    if (parse !== null) out.push({ run_id: id, kind: 'parse', measure: 'parse coverage', share: parse, count: null });
    const counts = IMPORT_OUTCOMES.map((c) => [c, num(r, c) ?? 0] as const);
    const total = counts.reduce((a, [, n]) => a + n, 0);
    if (total === 0) continue;
    for (const [c, n] of counts) out.push({ run_id: id, kind: 'import', measure: c, share: round6(n / total), count: n });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// FIG-07 threshold sweep

const SENSITIVITY_REQUIRED = ['run_id', 'scenario_id', 'purpose', 'thresholds', 'neural_aggregation', 'ahs_source', 'ahs', 'verdict'] as const;

/** FIG-07: every row must be `sensitivity-only` (BR-U5b-60). */
export function prepareSensitivity(table: CsvTable): FigureRow[] {
  const bad = table.rows.findIndex((r) => r.purpose !== 'sensitivity-only');
  if (bad !== -1) throw new FigureError(FIG_SENSITIVITY_PURPOSE, `row ${String(bad + 1)} has purpose ${JSON.stringify(table.rows[bad]?.purpose ?? '')}`);
  return table.rows.map((r) => ({
    row_label: `${r.run_id ?? ''} · ${r.ahs_source ?? ''}`, run_id: r.run_id ?? '', ahs_source: r.ahs_source ?? '', scenario: r.scenario_id ?? '',
    kind: (r.scenario_id ?? '').startsWith('thresholds:') ? 'threshold band' : 'neural aggregation', thresholds: r.thresholds ?? '',
    scenario_label: (r.scenario_id ?? '').replace(/^(thresholds|neural):/, ''),
    ahs: num(r, 'ahs'), verdict: r.verdict ?? '',
  })).sort((a, b) => (a.row_label < b.row_label ? -1 : a.row_label > b.row_label ? 1 : a.kind !== b.kind ? (a.kind < b.kind ? 1 : -1) : a.scenario < b.scenario ? -1 : a.scenario > b.scenario ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------
// Registry

export const FIGURES: readonly FigureDef[] = [
  {
    id: 'so4-prf-by-function', csv: 'prf_by_function.csv', svg: 'so4-prf-by-function.svg', objective: 'SO4', section: '8.1',
    title: 'SO4 detection per fitness function',
    caption: 'Seeded differential precision, recall and F1 per function on the chosen split (default held-out); a line shows an interval only where the CSV carries one (BR-U5b-61). Quote beside baseline precision (ADR-020 item 1).',
    requiredColumns: [...PRF_REQUIRED, 'function_id'], prepare: (t, o) => prepareSo4Prf(t, o, 'function_id'),
  },
  {
    id: 'so4-prf-by-tag', csv: 'prf_by_tag.csv', svg: 'so4-prf-by-tag.svg', objective: 'SO4', section: '8.1',
    title: 'SO4 detection per tag',
    caption: 'Seeded differential precision, recall and F1 per tag (FR-29) on the chosen split; data-flow is its own sub-row (TV-65).',
    requiredColumns: [...PRF_REQUIRED, 'tag', 'sub_row'], prepare: (t, o) => prepareSo4Prf(t, o, 'tag'),
  },
  {
    id: 'so5-grid-heatmap', csv: 'so5_grid.csv', svg: 'so5-grid-heatmap.svg', objective: 'SO5', section: '8.2',
    title: 'SO5 mean AHS per model and spec level',
    caption: 'Mean over valid E1 runs; label = mean (n valid / n cells). Verdict-source AHS and ahsDeterministic are co-primary (ADR-020 item 7). Descriptive; inference is in so5_tests.csv.',
    requiredColumns: SO5_REQUIRED, prepare: (t) => prepareSo5Heatmap(t),
  },
  {
    id: 'so5-interaction', csv: 'so5_grid.csv', svg: 'so5-interaction.svg', objective: 'SO5', section: '8.2',
    title: 'SO5 model × spec-level interaction',
    caption: 'Valid E1 runs (points) and the per-model mean (lines) over spec level, for both co-primary outcomes. Descriptive; inference is the Holm-corrected permutation test (ADR-020 item 6).',
    requiredColumns: SO5_REQUIRED, prepare: (t) => prepareSo5Interaction(t),
  },
  {
    id: 'so2-latency', csv: 'latency.csv', svg: 'so2-latency.svg', objective: 'SO2', section: '8.1',
    title: 'SO2 evaluation latency',
    caption: 'Total evaluation time against file count, and the cycle-query time per run against the 30 s H13 budget (ADR-016 e).',
    requiredColumns: LATENCY_REQUIRED, prepare: (t) => prepareLatency(t),
  },
  {
    id: 'so2-coverage', csv: 'coverage.csv', svg: 'so2-coverage.svg', objective: 'SO2', section: '8.1',
    title: 'SO2 structural coverage',
    caption: 'Parse coverage per run, and the share of each import-resolution outcome among all imports.',
    requiredColumns: COVERAGE_REQUIRED, prepare: (t) => prepareCoverage(t),
  },
  {
    id: 'threshold-sensitivity', csv: 'rescore_sensitivity.csv', svg: 'threshold-sensitivity.svg', objective: 'SO4/SO5', section: '7.2',
    title: 'Verdict under threshold bands and neural aggregation variants',
    caption: `${SENSITIVITY_CAPTION} (BR-U5b-60): the shipped thresholds 0.80 / 0.65 / 0.50 are never replaced in a reported table.`,
    requiredColumns: SENSITIVITY_REQUIRED, prepare: (t) => prepareSensitivity(t),
  },
];

/** FIG-01 then the figure's rule, as a result. */
export function prepareFigure(def: FigureDef, table: CsvTable, options: FigureOptions = DEFAULT_FIGURE_OPTIONS): PrepareResult {
  const missing = missingColumns(table.header, def.requiredColumns);
  if (missing.length > 0) return { ok: false, code: FIG_CSV_SCHEMA, detail: `${def.csv} lacks ${missing.join(', ')}` };
  try {
    return { ok: true, rows: def.prepare(table, options) };
  } catch (e) {
    if (e instanceof FigureError) return { ok: false, code: e.code, detail: `${def.csv}: ${e.message}` };
    throw e;
  }
}

/** Greedy word wrap of a caption into lines of at most `width` characters (a longer word keeps its own line). */
export function wrapCaption(text: string, width = CAPTION_WIDTH): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    if (line === '') line = word;
    else if (line.length + 1 + word.length <= width) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** The spec with the registry title and the wrapped caption, so the caption has a single source. */
export function specWithCaption(def: FigureDef, spec: Record<string, unknown>): Record<string, unknown> {
  const { usermeta: _usermeta, ...rest } = spec;
  return { ...rest, title: { text: def.title, subtitle: wrapCaption(def.caption), anchor: 'start', subtitleFontSize: 10 } };
}

export function loadThesisSpec(repoRoot: string, def: FigureDef): Record<string, unknown> {
  const p = join(repoRoot, THESIS_FIGURES_DIR, `${def.id}.vl.json`);
  if (!existsSync(p)) throw new FigureError(FIG_SPEC_MISSING, `${THESIS_FIGURES_DIR}/${def.id}.vl.json`);
  return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
}

/** Spec files in the thesis directory, sorted (for the registry ↔ file check). */
export function thesisSpecIds(repoRoot: string): string[] {
  return readdirSync(join(repoRoot, THESIS_FIGURES_DIR)).filter((f) => f.endsWith('.vl.json')).map((f) => f.slice(0, -'.vl.json'.length)).sort();
}

// ---------------------------------------------------------------------------------------------
// CLI main

export const FIGURES_USAGE = [
  'Usage: npx tsx scripts/figures-cli.ts --csv-dir <dir> [--out <dir>] [--split <split>] [--only <figure-id>]',
  '       npx tsx scripts/figures-cli.ts --list',
  '       npx tsx scripts/figures-cli.ts --self-test',
].join('\n');

export interface FiguresMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

/** Known-bad input of `--self-test`: a sensitivity row that claims to be tuning (BR-U5b-60). */
export const SELF_TEST_CSV = 'run_id,scenario_id,purpose,thresholds,neural_aggregation,ahs_source,ahs,verdict\nr1,thresholds:0.85/0.70/0.55,tuning,0.85/0.70/0.55,,ahsDeterministic,0.700,warning\n';

export async function main(argv: readonly string[], repoRoot: string, io: FiguresMainIo): Promise<number> {
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--self-test') {
      const def = FIGURES.find((f) => f.id === 'threshold-sensitivity');
      const r = def === undefined ? undefined : prepareFigure(def, parseCsv(SELF_TEST_CSV));
      io.err(`self-test: ${r !== undefined && !r.ok ? r.code : 'no refusal'}\n`);
      return 1;
    }
    if (a === '--list') {
      for (const f of FIGURES) io.out(`${f.id}\t${f.objective}\t${f.section}\t${f.csv} -> ${f.svg}\n`);
      return 0;
    }
    if (a.startsWith('--') && argv[i + 1] !== undefined) opts.set(a.slice(2), argv[++i] ?? '');
    else {
      io.err(`${FIGURES_USAGE}\n`);
      return 2;
    }
  }
  const csvDir = opts.get('csv-dir');
  if (csvDir === undefined) {
    io.err(`${FIGURES_USAGE}\n`);
    return 2;
  }
  const only = opts.get('only');
  const defs = only === undefined ? FIGURES : FIGURES.filter((f) => f.id === only);
  if (defs.length === 0) {
    io.err(`unknown figure ${only ?? ''}\n${FIGURES_USAGE}\n`);
    return 2;
  }
  const options: FigureOptions = { split: opts.get('split') ?? DEFAULT_FIGURE_OPTIONS.split };
  const inDir = resolve(repoRoot, csvDir);
  const outDir = resolve(repoRoot, opts.get('out') ?? csvDir);
  let failed = 0;
  let drawn = 0;
  for (const def of defs) {
    const csvPath = join(inDir, def.csv);
    if (!existsSync(csvPath)) {
      io.out(`skip ${def.id}: ${def.csv} not found\n`);
      continue;
    }
    const prepared = prepareFigure(def, parseCsv(readFileSync(csvPath, 'utf8')), options);
    if (!prepared.ok) {
      io.err(`${prepared.code}: ${def.id}: ${prepared.detail}\n`);
      failed++;
      continue;
    }
    if (prepared.rows.length === 0) {
      io.out(`skip ${def.id}: no rows in ${def.csv}\n`);
      continue;
    }
    try {
      const spec = specWithCaption(def, loadThesisSpec(repoRoot, def));
      io.writeFile(join(outDir, def.svg), await renderSvgValues(spec, prepared.rows));
      io.out(`wrote ${def.svg} (${String(prepared.rows.length)} rows)\n`);
      drawn++;
    } catch (e) {
      io.err(`${e instanceof Error ? e.message : String(e)}\n`);
      failed++;
    }
  }
  io.out(`${String(drawn)} SVG in ${outDir}\n`);
  return failed > 0 ? 1 : 0;
}
