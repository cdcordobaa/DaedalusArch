/**
 * v1.3 snapshot measures (gate D13, D16): a post-hoc scorer over a loop store or a floor-probe store that writes, per
 * snapshot, dependency-cruiser violations under the ADR-030 translation (per translated function), import-kind counts,
 * barrels, the unmatched (layer-coverage) share, LOC and file count, and the tool vs dependency-cruiser agreement on
 * FF-S01/S02/S03/S04/P01. Definitions and pass criterion: `Docs/v1.3/snapshot-measures.md`. Entry file.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/snapshot-measures.ts <store> [--out <dir>] [--depcruise-bin <path>]
 *
 * `<store>` is a loop output root (holds `runs/**\/run.json`) or a probe directory (holds `tasks.json` and
 * `<task>/<arm>/snapshots/step-NN`). `--out` defaults to `<store>/measures`; nothing is written anywhere else except
 * a scratch directory under the OS temp directory, removed at the end. dependency-cruiser is the pinned
 * `experiments/tool-comparison/depcruise` install (`npm ci` there first). No model call, no Neo4j, no live loop.
 * Exit codes: 0 done, 1 a snapshot could not be measured (recorded in its file), 2 usage or setup error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractionExcludes, translateSpec } from '../depcruise-translate.js';
import { DEPCRUISE_BIN, depcruiseFindings, findingKey } from '../tool-comparison.js';
import type { Finding } from '../tool-comparison.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { unmatchedShare } from '../lib/loop/pilot-metrics.js';
import { checkoutCommit } from '../lib/loop/replay.js';
import { globToRegex } from '../../src/fitness-compiler/glob-to-regex.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import {
  agreement, AGREEMENT_FUNCTIONS, cmp, HELD_OUT_REASON, IMPORT_KINDS, toolFindings, treeMeasures,
} from './lib/snapshot-measures.js';
import type { Agreement, ClassifyContext, ToolRow } from './lib/snapshot-measures.js';

const REPO = process.cwd();

interface SnapshotRef {
  /** Store-relative id; the measures file is `<out>/<id>.json`. */
  readonly id: string;
  readonly store: 'loop' | 'probe';
  readonly task: string;
  readonly arm: string;
  readonly snapshot: string;
  readonly specPath: string | null;
  /** Repository- or store-relative spec path as recorded. */
  readonly specRecorded: string | null;
  readonly toolRows: readonly ToolRow[] | null;
  readonly toolBlocking: number | null;
  readonly materialise: (into: string) => void;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function walk(dir: string, skip: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
    if (skip(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, skip));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

interface LoopStepFile {
  readonly stepIndex: number;
  readonly evaluatorSpec?: { readonly kind: 'static' | 'frozen-after-step-1'; readonly path: string };
  readonly turns: readonly { readonly turnId: string; readonly snapshot: { readonly commit: string; readonly evaluation: { readonly blockingViolationCount: number; readonly blockingFindings: readonly ToolRow[] } | null } }[];
}

function loopSnapshots(store: string): SnapshotRef[] {
  const runFiles = walk(store, (n) => n === 'work' || n === 'snapshots.git' || n === 'node_modules' || n === 'measures' || n === 'turns')
    .filter((f) => path.basename(f) === 'run.json');
  const out: SnapshotRef[] = [];
  for (const rf of runFiles) {
    const runDir = path.dirname(rf);
    const run = readJson<{ runId: string; spec: { taskId: string; arm: string } }>(rf);
    const stepsDir = path.join(runDir, 'steps');
    const stepFiles = fs.existsSync(stepsDir) ? fs.readdirSync(stepsDir).filter((f) => /^step-\d+\.json$/.test(f)).sort() : [];
    for (const sf of stepFiles) {
      const step = readJson<LoopStepFile>(path.join(stepsDir, sf));
      const es = step.evaluatorSpec;
      const specPath = es === undefined ? null : es.kind === 'static' ? path.resolve(REPO, es.path) : path.join(runDir, es.path);
      for (const t of step.turns) {
        const ev = t.snapshot.evaluation;
        out.push({
          id: path.posix.join('runs', run.runId, t.turnId),
          store: 'loop', task: run.spec.taskId, arm: run.spec.arm, snapshot: t.turnId,
          specPath, specRecorded: es?.path ?? null,
          toolRows: ev?.blockingFindings ?? null, toolBlocking: ev?.blockingViolationCount ?? null,
          materialise: (into) => checkoutCommit(path.join(runDir, 'snapshots.git'), t.snapshot.commit, into),
        });
      }
    }
  }
  return out.sort((a, b) => cmp(a.id, b.id));
}

function probeSnapshots(store: string): SnapshotRef[] {
  const out: SnapshotRef[] = [];
  for (const task of fs.readdirSync(store).sort()) {
    const taskDir = path.join(store, task);
    if (!fs.statSync(taskDir).isDirectory()) continue;
    for (const arm of fs.readdirSync(taskDir).sort()) {
      const snapDir = path.join(taskDir, arm, 'snapshots');
      if (!fs.existsSync(snapDir)) continue;
      for (const step of fs.readdirSync(snapDir).filter((s) => /^step-\d+$/.test(s)).sort()) {
        const recFile = path.join(taskDir, arm, arm === 'tool' ? `${step}.post.json` : `${step}.json`);
        const rec = fs.existsSync(recFile) ? readJson<{ spec?: string; blockingViolationCount?: number; blockingFindings?: ToolRow[] }>(recFile) : null;
        const spec = rec?.spec ?? null;
        out.push({
          id: path.posix.join(task, arm, step), store: 'probe', task, arm, snapshot: step,
          specPath: spec === null ? null : path.resolve(REPO, spec), specRecorded: spec,
          toolRows: rec?.blockingFindings ?? null, toolBlocking: rec?.blockingViolationCount ?? null,
          materialise: (into) => fs.cpSync(path.join(snapDir, step), into, { recursive: true }),
        });
      }
    }
  }
  return out;
}

interface DcResult {
  readonly findings: Finding[];
  readonly totalCruised: number | null;
  readonly error?: string;
}

function runDepcruise(bin: string, tree: string, cfgFile: string): DcResult {
  const r = spawnSync(bin, ['--config', cfgFile, '--output-type', 'json', 'src'], { cwd: tree, encoding: 'utf8', maxBuffer: 1 << 30 });
  try {
    const data = JSON.parse(r.stdout) as { summary: { totalCruised?: number; violations: Parameters<typeof depcruiseFindings>[0] } };
    return { findings: depcruiseFindings(data.summary.violations), totalCruised: data.summary.totalCruised ?? null };
  } catch {
    return { findings: [], totalCruised: null, error: `no JSON (exit ${String(r.status)}): ${r.stderr.slice(0, 400)}` };
  }
}

async function exclusionOf(specPath: string): Promise<ClassifyContext['excluded']> {
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) return () => false;
  const extractor = extractionExcludes(specExcludePathsFromYaml(fs.readFileSync(specPath, 'utf8'))).map((r) => new RegExp(r));
  const byFn = new Map(parsed.data.fitnessFunctions.map((ff) => [String(ff.id), ff.excludePaths.map((g) => new RegExp(globToRegex(g)))]));
  return (fn, file) => extractor.some((r) => r.test(file)) || (byFn.get(fn) ?? []).some((r) => r.test(file));
}

interface SnapshotMeasures {
  readonly schema: 'snapshot-measures/v1';
  readonly id: string;
  readonly store: 'loop' | 'probe';
  readonly task: string;
  readonly arm: string;
  readonly snapshot: string;
  readonly spec: string | null;
  readonly files: number;
  readonly loc: number;
  readonly unmatchedShare: number | null;
  readonly coverageShare: number | null;
  readonly importKinds: Record<string, number>;
  readonly barrels: readonly string[];
  readonly depcruise: {
    readonly version: string;
    readonly translationVersion: string | null;
    readonly totalCruised: number | null;
    readonly translated: readonly string[];
    readonly skipped: readonly { readonly functionId: string; readonly kind: string }[];
    readonly byFunction: Readonly<Record<string, { readonly count: number; readonly keys: readonly string[] }>>;
    readonly error?: string;
  };
  readonly tool: {
    readonly blockingViolationCount: number | null;
    readonly rowsCompared: number | null;
    /** Blocking rows of functions with no translated rule on this spec, per function id (no depcruise counterpart). */
    readonly rowsNotComparable: Readonly<Record<string, number>> | null;
  };
  readonly agreement: Agreement | null;
  readonly heldOut: { readonly value: null; readonly reason: string };
}

async function measure(ref: SnapshotRef, scratch: string, bin: string, dcVersion: string): Promise<SnapshotMeasures> {
  const work = fs.mkdtempSync(path.join(scratch, 'snap-'));
  const tree = path.join(work, 'tree');
  ref.materialise(tree);
  const texts = new Map<string, string>();
  for (const abs of walk(tree, (n) => n === 'node_modules' || n === '.git')) {
    const rel = path.relative(tree, abs).split(path.sep).join('/');
    if (rel.endsWith('.ts')) texts.set(rel, fs.readFileSync(abs, 'utf8'));
  }
  const tm = treeMeasures(texts);
  if (!fs.existsSync(path.join(tree, 'tsconfig.json'))) fs.writeFileSync(path.join(tree, 'tsconfig.json'), harnessTsconfigText(tree));

  let unmatched: number | null = null;
  let translationVersion: string | null = null;
  let translated: string[] = [];
  let skipped: { functionId: string; kind: string }[] = [];
  let dc: DcResult = { findings: [], totalCruised: null, error: 'no spec recorded for this snapshot' };
  let agr: Agreement | null = null;
  if (ref.specPath !== null) {
    unmatched = await unmatchedShare(ref.specPath, tm.sourceFiles.map((f) => f.slice('src/'.length)));
    try {
      const tr = await translateSpec(ref.specPath);
      translationVersion = tr.translationVersion;
      translated = tr.translated.map((t) => t.functionId).sort();
      skipped = tr.skipped.map((s) => ({ functionId: s.functionId, kind: s.kind })).sort((a, b) => cmp(a.functionId, b.functionId));
      const cfg = path.join(work, 'depcruise.json');
      fs.writeFileSync(cfg, JSON.stringify(tr.config));
      dc = runDepcruise(bin, tree, cfg);
    } catch (e) {
      dc = { findings: [], totalCruised: null, error: `translation failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (dc.error === undefined && ref.toolRows !== null) {
      const ctx: ClassifyContext = {
        files: new Set(texts.keys()), perFile: tm.perFile, barrels: new Set(tm.barrels), excluded: await exclusionOf(ref.specPath),
      };
      agr = agreement(toolFindings(ref.toolRows, AGREEMENT_FUNCTIONS), dc.findings, translated, ctx);
    }
  }
  fs.rmSync(work, { recursive: true, force: true });

  const byFunction: Record<string, { count: number; keys: string[] }> = {};
  for (const fn of translated) {
    const keys = dc.findings.filter((f) => f.functionId === fn).map(findingKey).sort();
    byFunction[fn] = { count: keys.length, keys };
  }
  const importKinds: Record<string, number> = {};
  for (const k of IMPORT_KINDS) importKinds[k] = tm.importKinds[k];
  return {
    schema: 'snapshot-measures/v1',
    id: ref.id, store: ref.store, task: ref.task, arm: ref.arm, snapshot: ref.snapshot, spec: ref.specRecorded,
    files: tm.files, loc: tm.loc,
    unmatchedShare: unmatched, coverageShare: unmatched === null ? null : 1 - unmatched,
    importKinds, barrels: tm.barrels,
    depcruise: {
      version: dcVersion, translationVersion, totalCruised: dc.totalCruised, translated, skipped, byFunction,
      ...(dc.error !== undefined ? { error: dc.error } : {}),
    },
    tool: {
      blockingViolationCount: ref.toolBlocking,
      rowsCompared: ref.toolRows === null || agr === null ? null : agr.compared.reduce((n, c) => n + c.tool, 0),
      rowsNotComparable: ref.toolRows === null ? null : notComparable(ref.toolRows, agr?.compared.map((c) => c.functionId) ?? []),
    },
    agreement: agr,
    heldOut: { value: null, reason: HELD_OUT_REASON },
  };
}

/** Tool blocking rows per function id outside `compared` (sorted keys). */
function notComparable(rows: readonly ToolRow[], compared: readonly string[]): Record<string, number> {
  const n = new Map<string, number>();
  for (const r of rows) {
    const fn = r.ruleId ?? r.rule ?? '';
    if (!compared.includes(fn)) n.set(fn, (n.get(fn) ?? 0) + 1);
  }
  return Object.fromEntries([...n].sort((a, b) => cmp(a[0], b[0])));
}

function fmtShare(x: number | null): string {
  return x === null ? 'n/a' : x.toFixed(3);
}

function summaryMarkdown(rows: readonly SnapshotMeasures[]): string {
  const lines: string[] = [
    '# Snapshot measures summary',
    '',
    'Development-set data (scripted replay tapes, one-session probe trees); not a validity estimate. Definitions: `Docs/v1.3/snapshot-measures.md`.',
    '',
    '| Snapshot | Files | LOC | Unmatched | static | type | dynamic | require | re-export | Barrels | depcruise (per function) | Tool blocking | Agreement both / tool-only / dc-only | Tool rows not comparable |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const dcs = r.depcruise.error !== undefined ? `error` : Object.entries(r.depcruise.byFunction).filter(([, v]) => v.count > 0).map(([k, v]) => `${k}:${String(v.count)}`).join(' ') || '0';
    const a = r.agreement;
    const agr = a === null ? 'n/a' : (() => {
      const s = a.compared.reduce((acc, c) => [acc[0] + c.both, acc[1] + c.toolOnly.length, acc[2] + c.depcruiseOnly.length] as [number, number, number], [0, 0, 0] as [number, number, number]);
      return `${String(s[0])} / ${String(s[1])} / ${String(s[2])}`;
    })();
    const k = r.importKinds;
    const nc = r.tool.rowsNotComparable === null ? 'n/a' : Object.entries(r.tool.rowsNotComparable).map(([f, x]) => `${f}:${String(x)}`).join(' ') || '0';
    lines.push(`| ${r.id} | ${String(r.files)} | ${String(r.loc)} | ${fmtShare(r.unmatchedShare)} | ${String(k.static)} | ${String(k.typeOnly)} | ${String(k.dynamic)} | ${String(k.require)} | ${String(k.reexport)} | ${String(r.barrels.length)} | ${dcs} | ${String(r.tool.blockingViolationCount ?? 'n/a')} | ${agr} | ${nc} |`);
  }
  const tot = aggregate(rows);
  lines.push('', '## Agreement over all snapshots (distinct keys per snapshot, summed)', '', '| Function | Snapshots compared | Both | Tool only | depcruise only |', '|---|---|---|---|---|');
  for (const [fn, v] of Object.entries(tot.byFunction)) lines.push(`| ${fn} | ${String(v.snapshots)} | ${String(v.both)} | ${String(v.toolOnly)} | ${String(v.depcruiseOnly)} |`);
  lines.push('', '## Reason classes of one-sided keys', '', '| Side | Class | Keys |', '|---|---|---|');
  for (const [k, n] of Object.entries(tot.reasons)) { const [side, cls] = k.split('|'); lines.push(`| ${side ?? ''} | ${cls ?? ''} | ${String(n)} |`); }
  return `${lines.join('\n')}\n`;
}

function aggregate(rows: readonly SnapshotMeasures[]): { byFunction: Record<string, { snapshots: number; both: number; toolOnly: number; depcruiseOnly: number }>; reasons: Record<string, number> } {
  const byFunction: Record<string, { snapshots: number; both: number; toolOnly: number; depcruiseOnly: number }> = {};
  const reasons: Record<string, number> = {};
  for (const fn of AGREEMENT_FUNCTIONS) byFunction[fn] = { snapshots: 0, both: 0, toolOnly: 0, depcruiseOnly: 0 };
  for (const r of rows) {
    for (const c of r.agreement?.compared ?? []) {
      const b = byFunction[c.functionId];
      if (b === undefined) continue;
      b.snapshots++; b.both += c.both; b.toolOnly += c.toolOnly.length; b.depcruiseOnly += c.depcruiseOnly.length;
      for (const x of c.toolOnly) reasons[`tool-only|${x.reason}`] = (reasons[`tool-only|${x.reason}`] ?? 0) + 1;
      for (const x of c.depcruiseOnly) reasons[`depcruise-only|${x.reason}`] = (reasons[`depcruise-only|${x.reason}`] ?? 0) + 1;
    }
  }
  const sortedReasons: Record<string, number> = {};
  for (const k of Object.keys(reasons).sort()) sortedReasons[k] = reasons[k] ?? 0;
  return { byFunction, reasons: sortedReasons };
}

async function main(argv: readonly string[]): Promise<number> {
  const opt = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && (argv[i - 1] ?? '').startsWith('--')));
  const storeArg = positional[0];
  if (storeArg === undefined || positional.length !== 1) {
    process.stderr.write('usage: npx tsx scripts/v1.3/snapshot-measures.ts <store> [--out <dir>] [--depcruise-bin <path>]\n');
    return 2;
  }
  const store = path.resolve(storeArg);
  const out = path.resolve(opt('--out') ?? path.join(store, 'measures'));
  const bin = path.resolve(opt('--depcruise-bin') ?? path.join(REPO, DEPCRUISE_BIN));
  if (!fs.existsSync(bin)) { process.stderr.write(`dependency-cruiser not installed: run npm ci in ${path.dirname(path.dirname(path.dirname(bin)))}\n`); return 2; }
  const v = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  const dcVersion = v.stdout.trim();
  const refs = fs.existsSync(path.join(store, 'tasks.json')) ? probeSnapshots(store) : loopSnapshots(store);
  if (refs.length === 0) { process.stderr.write(`no snapshots under ${store}\n`); return 2; }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-measures-'));
  const rows: SnapshotMeasures[] = [];
  try {
    for (const ref of refs) {
      const m = await measure(ref, scratch, bin, dcVersion);
      const file = path.join(out, `${ref.id}.json`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(m, null, 2)}\n`);
      rows.push(m);
      process.stdout.write(`${ref.id}: files=${String(m.files)} loc=${String(m.loc)} dc=${m.depcruise.error ?? 'ok'}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const failed = rows.filter((r) => r.depcruise.error !== undefined).length;
  const summary = {
    schema: 'snapshot-measures-summary/v1', depcruiseVersion: dcVersion, snapshots: rows.length, failed,
    aggregate: aggregate(rows),
    rows: rows.map((r) => ({
      id: r.id, files: r.files, loc: r.loc, unmatchedShare: r.unmatchedShare, importKinds: r.importKinds, barrels: r.barrels.length,
      depcruise: Object.fromEntries(Object.entries(r.depcruise.byFunction).map(([k, x]) => [k, x.count])),
      toolBlocking: r.tool.blockingViolationCount,
    })),
  };
  fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'summary.md'), summaryMarkdown(rows));
  process.stdout.write(`${String(rows.length)} snapshots, ${String(failed)} not measured; ${out}\n`);
  return failed > 0 ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (c) => { process.exitCode = c; },
  (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; },
);
