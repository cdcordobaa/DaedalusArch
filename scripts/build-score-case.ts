/**
 * Run-to-score-case adapter (ADR-021 SO4-04; FR-25, FR-36; BR-U5b-25, 46; MAT-25).
 *
 * `run-experiment` writes a plan's results as `<runDir>/runs/<runId>.run.json` and `<runDir>/reports/<runId>.json`;
 * `score-golden --case <dir>` reads `<case>/manifest.json` and `<case>/reports/*.run.json`, with every report path
 * relative to the case directory. This adapter turns the first layout into the second, so a registered `so4-heldout`
 * run is scored without hand assembly:
 * - the manifest is the one every seeded record names (`seed.manifestPath`, repository-relative), or `--manifest`;
 * - every record is copied to `reports/<runId>.run.json` and every stored report keeps its run-dir path
 *   (`reports/<runId>.json`), so `reportPath` and `seed.baselineReportPath` resolve unchanged;
 * - the baseline convention: a seeded plan entry's `seed.baselineReportPath` is `reports/<runId>.json` of the
 *   baseline entry of the same plan (`reportPathOfRun(runIdOf(planId, baselineEntry))`, deterministic before the run);
 * - nothing is filtered: a rejected, incomplete or missing run stays in the case, and `score-golden` lists the pair
 *   with its reason and scores the rest (ADR-021 SO4-03). The adapter's own row table names the pairs it already
 *   knows to be unusable.
 *
 * Pure planning (`planScoreCase`) is separate from the file copy (`writeScoreCase`).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadManifest } from './lib/manifest.js';
import type { ManifestRow } from './lib/manifest.js';
import { loadRunRecords } from './lib/report-io.js';
import type { RunRecord } from './lib/report-io.js';
import { relativizePaths } from './run-experiment.js';
import { pairRuns } from './score-golden.js';

export const CASE_INPUT_INVALID = 'CASE_INPUT_INVALID';
export const CASE_OUT_NOT_EMPTY = 'CASE_OUT_NOT_EMPTY';

/** One file of the case: `from` relative to the run directory, `to` relative to the case directory. */
export interface CaseCopy { readonly from: string; readonly to: string }

/** One manifest row of the case: `paired` when both runs are present and accepted, else the reason. */
export interface CaseRow {
  readonly seedId: string;
  readonly status: 'paired' | 'unusable';
  readonly reason?: string;
}

export interface ScoreCasePlan {
  readonly copies: readonly CaseCopy[];
  readonly rows: readonly CaseRow[];
}

/** The manifest path named by the seeded records (all must agree); `undefined` with no seeded record. */
export function manifestPathOf(records: readonly RunRecord[]): { ok: true; value: string | undefined } | { ok: false; detail: string } {
  const paths = [...new Set(records.flatMap((r) => (r.seed === undefined ? [] : [r.seed.manifestPath])))].sort();
  if (paths.length > 1) return { ok: false, detail: `seeded records name ${String(paths.length)} manifests (${paths.join(', ')}); pass --manifest` };
  return { ok: true, value: paths[0] };
}

/**
 * Plans the case of a run directory: the files to copy and, per manifest row, whether its pair is usable.
 * `reportExists` tells whether a run-dir relative report path exists.
 */
export function planScoreCase(
  rows: readonly ManifestRow[], records: readonly RunRecord[], reportExists: (relPath: string) => boolean,
): ScoreCasePlan {
  const copies: CaseCopy[] = [];
  for (const r of [...records].sort((a, b) => (a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0))) {
    copies.push({ from: `runs/${r.runId}.run.json`, to: `reports/${r.runId}.run.json` });
    if (r.reportPath !== undefined && reportExists(r.reportPath)) copies.push({ from: r.reportPath, to: r.reportPath });
  }
  const paired = pairRuns(rows, records, (rel) => (reportExists(rel) ? {} : undefined));
  const caseRows = paired.map((p): CaseRow => {
    for (const [role, run] of [['seeded', p.seeded], ['baseline', p.baseline]] as const) {
      if (run.unavailable !== undefined) return { seedId: p.row.seedId, status: 'unusable', reason: `${role}: ${run.unavailable}` };
      if (run.record !== undefined && run.record.status !== 'accepted') {
        return { seedId: p.row.seedId, status: 'unusable', reason: `${role}: run ${run.record.runId} ${run.record.status}${run.record.reasonCode === undefined ? '' : ` (${run.record.reasonCode})`}` };
      }
    }
    return { seedId: p.row.seedId, status: 'paired' };
  });
  return { copies, rows: caseRows };
}

/**
 * Copies the planned files and the manifest into `caseDir` (which must be absent or empty). With `repoRoot`, the
 * manifest is written with absolute paths made repository-relative (its rows record the absolute `typecheck.tscPath`
 * of the machine that ran `mutate`), because a case under `results/` is committed.
 */
export function writeScoreCase(runDir: string, manifestFile: string, caseDir: string, plan: ScoreCasePlan, repoRoot?: string): void {
  mkdirSync(join(caseDir, 'reports'), { recursive: true });
  if (repoRoot === undefined) copyFileSync(manifestFile, join(caseDir, 'manifest.json'));
  else writeFileSync(join(caseDir, 'manifest.json'), `${JSON.stringify(relativizePaths(JSON.parse(readFileSync(manifestFile, 'utf8')) as unknown, repoRoot), null, 2)}\n`);
  for (const c of plan.copies) {
    mkdirSync(dirname(join(caseDir, c.to)), { recursive: true });
    copyFileSync(join(runDir, c.from), join(caseDir, c.to));
  }
}

// ---------------------------------------------------------------------------------------------
// CLI main (entry file `scripts/build-score-case-cli.ts`)

export const CASE_USAGE = [
  'usage: npx tsx scripts/build-score-case-cli.ts --runs <run-experiment outDir> --out <case dir> [--manifest <manifest.json>]',
  '       npx tsx scripts/build-score-case-cli.ts --self-test | --help',
  '',
  'Turns a run-experiment output directory (runs/*.run.json, reports/*.json) into a score-golden case directory',
  '(manifest.json, reports/*.run.json, reports/*.json). The manifest is the one the seeded records name, or --manifest.',
  'Every run is kept: score-golden lists an unusable pair with its reason and scores the rest (ADR-021 SO4-03, 04).',
  'Prints one line per manifest row (paired / unusable with the reason) and a summary.',
  'Exit: 0 written; 1 refused (CASE_INPUT_INVALID, CASE_OUT_NOT_EMPTY) or self-test; 2 usage or input error.',
  '',
].join('\n');

export interface CaseMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

function parseArgs(argv: readonly string[]): Map<string, string | true> | string {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (a === '--help' || a === '--self-test') {
      args.set(a, true);
      continue;
    }
    if (a === '--runs' || a === '--out' || a === '--manifest') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return `${a} needs a value`;
      args.set(a, v);
      i += 1;
      continue;
    }
    return `unknown argument ${a}`;
  }
  return args;
}

/** Built-in known-bad input for `--self-test`: two seeded records naming different manifests. */
const SELF_TEST_RECORDS = [
  { seed: { manifestPath: 'a/manifest.json' } },
  { seed: { manifestPath: 'b/manifest.json' } },
] as unknown as RunRecord[];

export function main(argv: readonly string[], repoRoot: string, io: CaseMainIo): number {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.err(`${args}\n${CASE_USAGE}`);
    return 2;
  }
  if (args.has('--help')) {
    io.out(CASE_USAGE);
    return 0;
  }
  if (args.has('--self-test')) {
    const r = manifestPathOf(SELF_TEST_RECORDS);
    io.err(r.ok ? 'self-test: known-bad input was accepted\n' : `self-test: ${CASE_INPUT_INVALID}: ${r.detail}\n`);
    return 1;
  }
  const runsArg = args.get('--runs');
  const outArg = args.get('--out');
  if (typeof runsArg !== 'string' || typeof outArg !== 'string') {
    io.err(`--runs and --out are required\n${CASE_USAGE}`);
    return 2;
  }
  const runDir = resolve(repoRoot, runsArg);
  const caseDir = resolve(repoRoot, outArg);
  if (existsSync(caseDir) && readdirSync(caseDir).length > 0) {
    io.err(`${CASE_OUT_NOT_EMPTY}: ${outArg} exists and is not empty\n`);
    return 1;
  }
  let records: RunRecord[];
  try {
    records = loadRunRecords(runDir, CASE_INPUT_INVALID); // records only: planScoreCase needs existence checks, not parsed reports
  } catch (e) {
    io.err(`input error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  const manifestArg = args.get('--manifest');
  let manifestRel: string | undefined;
  if (typeof manifestArg === 'string') manifestRel = manifestArg;
  else {
    const named = manifestPathOf(records);
    if (!named.ok) {
      io.err(`${CASE_INPUT_INVALID}: ${named.detail}\n`);
      return 1;
    }
    manifestRel = named.value;
  }
  if (manifestRel === undefined) {
    io.err(`${CASE_INPUT_INVALID}: no seeded record names a manifest; pass --manifest\n`);
    return 1;
  }
  const manifestFile = resolve(repoRoot, manifestRel);
  const manifest = loadManifest(repoRoot, manifestFile);
  if (!manifest.success) {
    io.err(`${CASE_INPUT_INVALID}: ${manifest.errors.map((e) => e.message).join('; ')}\n`);
    return 1;
  }
  const plan = planScoreCase(manifest.data.rows, records, (rel) => existsSync(join(runDir, rel)));
  writeScoreCase(runDir, manifestFile, caseDir, plan, repoRoot);
  for (const r of plan.rows) io.out(`${r.seedId}\t${r.status}${r.reason === undefined ? '' : `\t${r.reason}`}\n`);
  const usable = plan.rows.filter((r) => r.status === 'paired').length;
  io.out(`case ${outArg}: ${String(plan.rows.length)} rows, ${String(usable)} paired, ${String(plan.rows.length - usable)} unusable; ${String(plan.copies.length)} files\n`);
  writeFileSync(join(caseDir, 'case-rows.json'), `${JSON.stringify(plan.rows, null, 2)}\n`);
  return 0;
}
