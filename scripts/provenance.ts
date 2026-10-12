/**
 * Producers and checks for three SO4 / E7 provenance gaps of the independent reproduction audit (2026-10-10, issue 4).
 * Each command rebuilds a committed file from committed inputs, or checks it, so a reader no longer needs the git
 * history or an outside file to tie it to its inputs:
 *
 * - `guard-case --manifest <in> --out <out>`: the ADR-025 item 2 style guard applied to a score-case manifest, by
 *   the functions the seeding uses (`styleGuardedFunctionIds`, `applyStyleGuard` of `scripts/lib/mutation/expected.ts`).
 *   Only positive rows of a guarded (style, operator) pair change; the spec of such a row must still have the
 *   `specSha256` the row records. `results/so4-heldout/case-corrected/manifest.json` was written by hand from the same
 *   functions; this command rebuilds it byte for byte.
 * - `v1-sensitivity --v1-runs <dir> --v2-runs <dir> --out <csv>`: the E7 v1 symbolic sensitivity table
 *   (`results/e7-corpus/v1/ahs_v1_sensitivity.csv`, analysis plan §10 B8) from the accepted RunRecords and reports of
 *   the v1 symbolic-only re-evaluation and the v2 runs: per project (v2 run order), the v1 row then the v2 row.
 * - `external --write | --check`: `results/<plan>/external-inputs.json` (`so4-heldout`, `sensitivity`), the sha256 of the inputs that live outside the
 *   repository (`../daedalus-so4/manifest.json`, `../daedalus-so4/prepared-bases-7.json`,
 *   `../daedalus-sp-probes/manifest.json`) and, for an outside manifest with a committed case copy, whether the copy
 *   equals the outside file once the machine-local `typecheck.tscPath` fields are set aside (`build-score-case` makes
 *   them relative to the worktree it ran in, which differs between runs). `--check` exits 1 when an outside file is present and its hash or its copy relation
 *   differs from the committed record; an absent outside file is reported, not refused.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { applyStyleGuard, loadCompiledSpec, STYLE_GUARDED_EXPECTED, styleGuardedFunctionIds } from './lib/mutation/expected.js';

export const PROVENANCE_REFUSED = 'PROVENANCE_REFUSED';

interface GuardRow {
  readonly seedId: string;
  readonly operatorId: string;
  readonly specPath: string;
  readonly specSha256: string;
  readonly expected: {
    readonly negative?: boolean;
    readonly functionIds: readonly string[];
    readonly disabledFunctionIds: readonly { readonly functionId: string; readonly reason: string }[];
    readonly keys: readonly { readonly functionId: string }[];
  };
}

const GUARDED_OPERATORS = new Set(Object.values(STYLE_GUARDED_EXPECTED).flatMap((byOp) => Object.keys(byOp)));

/** The guarded manifest (same object shape and key order); throws `PROVENANCE_REFUSED` on a spec hash mismatch. */
export async function guardManifest(repoRoot: string, manifest: { readonly rows: readonly GuardRow[] }): Promise<{ manifest: unknown; changed: string[] }> {
  const changed: string[] = [];
  const rows: unknown[] = [];
  for (const row of manifest.rows) {
    if (row.expected.negative === true || !GUARDED_OPERATORS.has(row.operatorId)) {
      rows.push(row);
      continue;
    }
    const compiled = await loadCompiledSpec(repoRoot, row.specPath);
    if (!compiled.success) throw new Error(`${PROVENANCE_REFUSED}: ${row.seedId}: ${compiled.errors.map((e) => e.message).join('; ')}`);
    if (compiled.data.specSha256 !== row.specSha256) {
      throw new Error(`${PROVENANCE_REFUSED}: ${row.seedId}: ${row.specPath} sha256 ${compiled.data.specSha256} != recorded ${row.specSha256}`);
    }
    const guarded = applyStyleGuard(row.operatorId, compiled.data.spec.style ?? '', styleGuardedFunctionIds(compiled.data, row.operatorId), row.expected);
    if (guarded.functionIds.length === row.expected.functionIds.length) {
      rows.push(row);
      continue;
    }
    changed.push(row.seedId);
    rows.push({ ...row, expected: { ...row.expected, ...guarded } });
  }
  return { manifest: { ...manifest, rows }, changed };
}

// ---------------------------------------------------------------------------------------------
// v1 sensitivity table

interface RunLite { readonly runId: string; readonly projectId: string; readonly status: string; readonly reportPath?: string }
interface ReportLite {
  readonly evaluationMode: string;
  readonly ahsDeterministic: number;
  readonly ahsCombined?: number | null;
  readonly verdict: string;
  readonly violations: readonly { readonly route?: string }[];
}

export const V1_SENSITIVITY_COLUMNS = [
  'project_id', 'instrument', 'evaluation_mode', 'violations_symbolic', 'ahs_deterministic', 'verdict_deterministic_v1', 'ahs_combined', 'verdict',
] as const;

function acceptedRuns(dir: string): { run: RunLite; report: ReportLite }[] {
  const runsDir = join(dir, 'runs');
  return readdirSync(runsDir).filter((f) => f.endsWith('.run.json')).sort().map((f) => JSON.parse(readFileSync(join(runsDir, f), 'utf8')) as RunLite)
    .filter((r) => r.status === 'accepted' && r.reportPath !== undefined)
    .map((run) => ({ run, report: JSON.parse(readFileSync(join(dir, run.reportPath ?? ''), 'utf8')) as ReportLite }));
}

const f6 = (x: number | null | undefined): string => (x === null || x === undefined ? '' : x.toFixed(6));
const symbolicCount = (r: ReportLite): number => r.violations.filter((v) => v.route === 'symbolic').length;

/** The CSV text of the v1 sensitivity table; throws `PROVENANCE_REFUSED` when a v2 project has no single v1 run. */
export function v1SensitivityCsv(v1Dir: string, v2Dir: string): string {
  const v1 = acceptedRuns(v1Dir);
  const lines: string[] = [V1_SENSITIVITY_COLUMNS.join(',')];
  for (const { run, report } of acceptedRuns(v2Dir)) {
    const pair = v1.filter((x) => x.run.projectId === run.projectId);
    const one = pair[0];
    if (pair.length !== 1 || one === undefined) throw new Error(`${PROVENANCE_REFUSED}: ${run.projectId}: ${String(pair.length)} accepted v1 runs`);
    lines.push([run.projectId, 'v1', one.report.evaluationMode, String(symbolicCount(one.report)), f6(one.report.ahsDeterministic), one.report.verdict, '', ''].join(','));
    lines.push([run.projectId, 'v2', report.evaluationMode, String(symbolicCount(report)), f6(report.ahsDeterministic), '', f6(report.ahsCombined), report.verdict].join(','));
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// External inputs

/** Outside inputs (repository-relative paths), the plan record file that holds each, and its committed case copies. */
export const EXTERNAL_INPUTS: readonly { readonly path: string; readonly record: string; readonly copies: readonly string[]; readonly usedBy: string }[] = [
  { path: '../daedalus-so4/manifest.json', record: 'results/so4-heldout/external-inputs.json', copies: ['results/so4-heldout/case/manifest.json'], usedBy: 'every seeded so4-heldout RunRecord (seed.manifestPath); build-score-case; build-label-plan' },
  { path: '../daedalus-so4/prepared-bases-7.json', record: 'results/so4-heldout/external-inputs.json', copies: [], usedBy: 'build-label-plan --bases (runbook 6.1)' },
  { path: '../daedalus-sp-probes/manifest.json', record: 'results/sensitivity/external-inputs.json', copies: ['results/sensitivity/case/manifest.json', 'results/sensitivity/step31/case/manifest.json'], usedBy: 'every sensitivity SP-* RunRecord; build-score-case' },
];

/** The record files, in first-use order. */
export const EXTERNAL_INPUT_RECORDS: readonly string[] = [...new Set(EXTERNAL_INPUTS.map((e) => e.record))];

export interface ExternalRecord {
  readonly path: string;
  readonly usedBy: string;
  readonly sha256: string | null;
  readonly bytes: number | null;
  /** Per committed copy: its sha256 and whether it equals the outside file apart from `tscPath` fields. */
  readonly copies: readonly { readonly path: string; readonly sha256: string; readonly equalExceptTscPath: boolean | null }[];
}

const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

/** Canonical JSON of `value` with every `tscPath` member removed (the only machine-local field of a manifest). */
export function withoutTscPath(value: unknown): string {
  return JSON.stringify(value, (k, v: unknown) => (k === 'tscPath' ? undefined : v));
}

export function externalRecords(repoRoot: string): ExternalRecord[] {
  return EXTERNAL_INPUTS.map((e) => {
    const abs = resolve(repoRoot, e.path);
    const present = existsSync(abs);
    const bytes = present ? readFileSync(abs) : undefined;
    const outside = bytes === undefined ? undefined : withoutTscPath(JSON.parse(bytes.toString('utf8')));
    return {
      path: e.path, usedBy: e.usedBy, sha256: bytes === undefined ? null : sha(bytes), bytes: bytes === undefined ? null : bytes.length,
      copies: e.copies.map((c) => {
        const text = readFileSync(resolve(repoRoot, c), 'utf8');
        return { path: c, sha256: sha(text), equalExceptTscPath: outside === undefined ? null : outside === withoutTscPath(JSON.parse(text)) };
      }),
    };
  });
}

/** The committed records of every record file, concatenated. */
export function readExternalRecords(repoRoot: string): ExternalRecord[] {
  return EXTERNAL_INPUT_RECORDS.flatMap((f) => (JSON.parse(readFileSync(resolve(repoRoot, f), 'utf8')) as { inputs: ExternalRecord[] }).inputs);
}

/** Problems of the current outside files against the committed record (absent outside files are skipped). */
export function checkExternal(repoRoot: string, committed: readonly ExternalRecord[]): string[] {
  const problems: string[] = [];
  for (const now of externalRecords(repoRoot)) {
    const was = committed.find((c) => c.path === now.path);
    if (was === undefined) { problems.push(`${now.path}: not in its external-inputs.json record`); continue; }
    for (const c of now.copies) {
      const wc = was.copies.find((x) => x.path === c.path);
      if (wc?.sha256 !== c.sha256) problems.push(`${c.path}: sha256 ${c.sha256} != recorded ${wc?.sha256 ?? '(none)'}`);
    }
    if (now.sha256 === null) continue;
    if (now.sha256 !== was.sha256) problems.push(`${now.path}: sha256 ${now.sha256} != recorded ${was.sha256 ?? '(none)'}`);
    for (const c of now.copies) {
      const wc = was.copies.find((x) => x.path === c.path);
      if (wc !== undefined && wc.equalExceptTscPath !== null && c.equalExceptTscPath !== wc.equalExceptTscPath) problems.push(`${c.path}: copy relation ${String(c.equalExceptTscPath)} != recorded ${String(wc.equalExceptTscPath)}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// CLI

export interface ProvenanceIo {
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
}

const USAGE = `usage: npx tsx scripts/provenance-cli.ts guard-case --manifest <in.json> --out <out.json>
       npx tsx scripts/provenance-cli.ts v1-sensitivity --v1-runs <dir> --v2-runs <dir> --out <file.csv>
       npx tsx scripts/provenance-cli.ts external --write | --check
Exit: 0 written or checked; 1 refused (${PROVENANCE_REFUSED}) or a --check mismatch; 2 usage error.
`;

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  const v = at >= 0 ? argv[at + 1] : undefined;
  return v === undefined || v.startsWith('--') ? undefined : v;
}

function write(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

export async function main(argv: readonly string[], repoRoot: string, io: ProvenanceIo): Promise<number> {
  const [cmd] = argv;
  try {
    if (cmd === 'guard-case') {
      const input = flag(argv, '--manifest');
      const out = flag(argv, '--out');
      if (input === undefined || out === undefined) { io.err(USAGE); return 2; }
      const r = await guardManifest(repoRoot, JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as { rows: GuardRow[] });
      write(resolve(repoRoot, out), `${JSON.stringify(r.manifest, null, 2)}\n`);
      io.out(`${String(r.changed.length)} row(s) guarded: ${r.changed.join(', ')}\n`);
      return 0;
    }
    if (cmd === 'v1-sensitivity') {
      const v1 = flag(argv, '--v1-runs');
      const v2 = flag(argv, '--v2-runs');
      const out = flag(argv, '--out');
      if (v1 === undefined || v2 === undefined || out === undefined) { io.err(USAGE); return 2; }
      write(resolve(repoRoot, out), v1SensitivityCsv(resolve(repoRoot, v1), resolve(repoRoot, v2)));
      return 0;
    }
    if (cmd === 'external' && argv.includes('--write')) {
      const all = externalRecords(repoRoot);
      for (const file of EXTERNAL_INPUT_RECORDS) {
        const inputs = all.filter((r) => EXTERNAL_INPUTS.find((e) => e.path === r.path)?.record === file);
        write(resolve(repoRoot, file), `${JSON.stringify({ version: 1, inputs }, null, 2)}\n`);
      }
      return 0;
    }
    if (cmd === 'external' && argv.includes('--check')) {
      const problems = checkExternal(repoRoot, readExternalRecords(repoRoot));
      for (const p of problems) io.err(`${p}\n`);
      for (const r of externalRecords(repoRoot)) io.out(`${r.path}: ${r.sha256 === null ? 'absent (not checked)' : 'present'}\n`);
      return problems.length === 0 ? 0 : 1;
    }
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
  io.err(USAGE);
  return 2;
}
