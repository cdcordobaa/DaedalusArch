/**
 * v1.3 judge catch test (U-F, FR-V9), step 3: judge runs. DEVELOPMENT SET ONLY.
 *
 * Seeded-unit judging: every copy (seed, twin) and every unmodified base (the clean control) is evaluated through the
 * CLI in full mode with the v1.3 defaults, except that the judged set is restricted to the units that hold an edited
 * or created file, for the operator's probed function only (FF-N01 for integrity operators, FF-N02 for semantic
 * ones). On a base the judged set is the union of those units over the rows seeded on it. The restriction goes
 * through the registered variant mechanism (`--judge-baseline-report`, BR-U4-SEL-07): a baseline report whose
 * `selectedUnitIds` name the target units and whose `candidateUnitIds` are the copy's own candidates.
 *
 * Phases (repository root; Neo4j credentials in the environment, never printed):
 *   full-mock <work>   mock evaluate with the default selection: candidates and the symbolic rows of every target
 *   plan <work>        target units and the crafted baseline reports
 *   dry <work>         mock evaluate with the crafted selections into an empty cassette dir: projected calls
 *   record <work>      claude-cli record into the cassette dir, with the call budget; reports to results
 *   replay <work>      claude-cli replay of the recorded cassettes (no call); reports to <work>/replay
 * Options: --budget <n> (default 400), --cassettes <dir> (default tests/fixtures/judge-cassettes-v13/judge-catch),
 *   --results <dir> (default results/v1.3-judge-catch), --only <id,...>.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SeedRow } from './judge-catch-seed.js';

export const PROBED_FUNCTION: Readonly<Record<string, 'FF-N01' | 'FF-N02'>> = {
  'AP-REPO-BYPASS': 'FF-N01',
  'AP-DUP-RULE': 'FF-N01',
  'AP-DUP-RULE2': 'FF-N01',
  'AP-FAT-CONTROLLER': 'FF-N02',
  'AP-PERSIST-IN-DOMAIN': 'FF-N02',
  'AP-FRAMEWORK-LEAK': 'FF-N02',
};

export interface Target {
  /** Row id, or `base:<baseId>` for a clean control. */
  readonly id: string;
  readonly kind: 'seed' | 'twin' | 'clean';
  readonly projectDir: string;
  readonly specPath: string;
  /** Target unit ids per function. */
  readonly units: Readonly<Record<string, readonly string[]>>;
}

interface Manifest {
  readonly rows: readonly SeedRow[];
}

interface ReportLike {
  readonly neuralResults?: readonly {
    functionId: string;
    selection: { candidateUnitIds: string[]; selectedUnitIds: string[]; source: string };
    unitResults: { unitId: string; filePaths?: string[]; verdict: string }[];
  }[];
}

const REPO = process.cwd();

function arg(argv: readonly string[], name: string, dflt: string): string {
  const i = argv.indexOf(name);
  return (i >= 0 ? argv[i + 1] : undefined) ?? dflt;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function safe(id: string): string {
  return id.replace(/[/:]/g, '__');
}

function baseDirOf(work: string, baseId: string): string {
  return path.join(work, 'bases', baseId.replace('/', '__'));
}

function liveRows(work: string): SeedRow[] {
  return (readJson(path.join(work, 'seed-manifest.json')) as Manifest).rows.filter((r) => r.status === 'ok');
}

/** Every evaluated project: the ok rows and the bases they were seeded on. */
function projects(work: string): { id: string; kind: Target['kind']; dir: string; spec: string }[] {
  const rows = liveRows(work);
  const bases = [...new Map(rows.map((r) => [r.baseId, r])).values()];
  return [
    ...bases.map((r) => ({ id: `base:${r.baseId}`, kind: 'clean' as const, dir: baseDirOf(work, r.baseId), spec: r.specPath })),
    ...rows.map((r) => ({ id: r.rowId, kind: r.role, dir: path.join(work, r.copyDir), spec: r.specPath })),
  ];
}

interface EvalResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function evaluate(projectDir: string, spec: string, extra: readonly string[]): EvalResult {
  const tsx = path.resolve(REPO, 'node_modules/.bin/tsx');
  const args = ['bin/firewall.ts', 'evaluate', '--post-seal', 'off', '--project', projectDir, '--spec', spec, '--format', 'json', '--neo4j-uri', process.env.NEO4J_URI ?? '', ...extra];
  const r = spawnSync(tsx, args, { cwd: REPO, env: process.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 3_600_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function parseReport(stdout: string): ReportLike | null {
  const i = stdout.indexOf('{');
  if (i < 0) return null;
  try {
    return JSON.parse(stdout.slice(i)) as ReportLike;
  } catch {
    return null;
  }
}

/**
 * Candidate unit ids that hold `file`. A judged unit's own `filePaths` decide; a candidate that was not judged in
 * the default run (capped) falls back to its id: file, class (`Name@file`) or module (directory, or `dir#layer`).
 */
export function unitsHolding(candidates: readonly string[], filesOf: ReadonlyMap<string, readonly string[]>, file: string): string[] {
  const dir = path.posix.dirname(file);
  return candidates.filter((id) => {
    const known = filesOf.get(id);
    if (known !== undefined) return known.includes(file);
    return id === file || id.endsWith(`@${file}`) || id === dir || id.startsWith(`${dir}#`);
  });
}

function countEntries(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (sub === '_incomplete' || !fs.statSync(p).isDirectory()) continue;
    n += fs.readdirSync(p).filter((f) => f.endsWith('.json')).length;
  }
  return n;
}

function entryFiles(dir: string): Map<string, number> {
  const out = new Map<string, number>();
  if (!fs.existsSync(dir)) return out;
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (sub === '_incomplete' || !fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.json'))) {
      const e = readJson(path.join(p, f)) as { attempts?: number };
      out.set(f, e.attempts ?? 1);
    }
  }
  return out;
}

function fullMock(work: string, only: Set<string> | null): number {
  for (const p of projects(work)) {
    if (only !== null && !only.has(p.id)) continue;
    const out = path.join(work, 'mock-full', `${safe(p.id)}.json`);
    const r = evaluate(p.dir, p.spec, ['--llm-provider', 'mock', '--cassette-dir', path.join(work, 'mock-full-cassettes')]);
    const rep = parseReport(r.stdout);
    if (rep === null) {
      process.stderr.write(`${p.id}: no report (exit ${String(r.status)}): ${r.stderr.slice(-800)}\n`);
      return 1;
    }
    writeJson(out, rep);
    process.stderr.write(`${p.id}: exit ${String(r.status)}\n`);
  }
  return 0;
}

function plan(work: string): number {
  const rows = liveRows(work);
  const targets: Target[] = [];
  const baseUnits = new Map<string, Map<string, Set<string>>>();
  const rowOf = (id: string, fn: string): { cands: string[]; filesOf: Map<string, string[]> } => {
    const rep = readJson(path.join(work, 'mock-full', `${safe(id)}.json`)) as ReportLike;
    const row = rep.neuralResults?.find((n) => n.functionId === fn);
    if (row === undefined) throw new Error(`${id}: no neural row for ${fn}`);
    return { cands: row.selection.candidateUnitIds, filesOf: new Map(row.unitResults.filter((u) => u.filePaths !== undefined).map((u) => [u.unitId, u.filePaths ?? []])) };
  };
  const candidatesOf = (id: string, fn: string): string[] => rowOf(id, fn).cands;
  const skipped: { id: string; reason: string }[] = [];
  for (const r of rows) {
    const fn = PROBED_FUNCTION[r.positiveId];
    if (fn === undefined) throw new Error(`no probed function for ${r.positiveId}`);
    const hasFn = (readJson(path.join(work, 'mock-full', `${safe(r.rowId)}.json`)) as ReportLike).neuralResults?.some((n) => n.functionId === fn) === true;
    if (!hasFn) {
      // The base's spec declares no judged function (presets/ddd.yaml): the frozen judge does not run on it.
      skipped.push({ id: r.rowId, reason: `spec ${r.specPath} declares no ${fn}` });
      continue;
    }
    const files = [...new Set([...r.editedFiles, ...r.createdFiles])];
    const own = rowOf(r.rowId, fn);
    const units = [...new Set(files.flatMap((f) => unitsHolding(own.cands, own.filesOf, f)))].sort();
    if (units.length === 0) throw new Error(`${r.rowId}: no candidate unit holds ${files.join(', ')}`);
    targets.push({ id: r.rowId, kind: r.role, projectDir: path.join(work, r.copyDir), specPath: r.specPath, units: { [fn]: units } });
    const baseCands = candidatesOf(`base:${r.baseId}`, fn);
    const onBase = units.filter((u) => baseCands.includes(u));
    const m = baseUnits.get(r.baseId) ?? new Map<string, Set<string>>();
    const s = m.get(fn) ?? new Set<string>();
    for (const u of onBase) s.add(u);
    m.set(fn, s);
    baseUnits.set(r.baseId, m);
  }
  for (const [baseId, m] of baseUnits) {
    const spec = rows.find((r) => r.baseId === baseId)?.specPath ?? '';
    targets.unshift({
      id: `base:${baseId}`, kind: 'clean', projectDir: baseDirOf(work, baseId), specPath: spec,
      units: Object.fromEntries([...m].map(([fn, s]) => [fn, [...s].sort()])),
    });
  }
  // Crafted baseline reports: the mock report's rows with the selection narrowed to the target units.
  for (const t of targets) {
    const rep = readJson(path.join(work, 'mock-full', `${safe(t.id)}.json`)) as ReportLike;
    const neuralResults = (rep.neuralResults ?? []).map((n) => ({
      ...n,
      selection: { ...n.selection, source: 'own', selectedUnitIds: [...(t.units[n.functionId] ?? [])] },
    }));
    writeJson(path.join(work, 'baseline', `${safe(t.id)}.json`), { neuralResults });
  }
  writeJson(path.join(work, 'plan.json'), { targets, skipped });
  const n = targets.reduce((s, t) => s + Object.values(t.units).reduce((a, u) => a + u.length, 0), 0);
  process.stdout.write(`${String(targets.length)} targets, ${String(n)} judged units, ${String(n * 3)} unit runs before cassette reuse\n`);
  return 0;
}

function dry(work: string): number {
  const { targets } = readJson(path.join(work, 'plan.json')) as { targets: Target[] };
  const cas = path.join(work, 'mock-dry-cassettes');
  fs.rmSync(cas, { recursive: true, force: true });
  const perTarget: { id: string; newEntries: number }[] = [];
  for (const t of targets) {
    const before = countEntries(cas);
    const r = evaluate(t.projectDir, t.specPath, ['--llm-provider', 'mock', '--cassette-dir', cas, '--judge-baseline-report', path.join(work, 'baseline', `${safe(t.id)}.json`)]);
    const rep = parseReport(r.stdout);
    if (rep === null) {
      process.stderr.write(`${t.id}: no report (exit ${String(r.status)}): ${r.stderr.slice(-800)}\n`);
      return 1;
    }
    writeJson(path.join(work, 'mock-dry', `${safe(t.id)}.json`), rep);
    const added = countEntries(cas) - before;
    perTarget.push({ id: t.id, newEntries: added });
    process.stderr.write(`${t.id}: +${String(added)} entries\n`);
  }
  const entries = perTarget.reduce((s, x) => s + x.newEntries, 0);
  const projected = { targets: targets.length, entries, initProbes: targets.length, projectedCalls: entries + targets.length, perTarget };
  writeJson(path.join(work, 'dry-count.json'), projected);
  process.stdout.write(`projected calls: ${String(projected.projectedCalls)} (${String(entries)} judge entries + ${String(targets.length)} init probes)\n`);
  return 0;
}

function record(work: string, argv: readonly string[]): number {
  const budget = Number(arg(argv, '--budget', '400'));
  const cas = path.resolve(REPO, arg(argv, '--cassettes', 'tests/fixtures/judge-cassettes-v13/judge-catch'));
  const results = path.resolve(REPO, arg(argv, '--results', 'results/v1.3-judge-catch'));
  const { targets } = readJson(path.join(work, 'plan.json')) as { targets: Target[] };
  const dryCount = readJson(path.join(work, 'dry-count.json')) as { perTarget: { id: string; newEntries: number }[] };
  const ledgerFile = path.join(results, 'call-ledger.json');
  const ledger = fs.existsSync(ledgerFile)
    ? (readJson(ledgerFile) as { calls: number; runs: { id: string; exit: number | null; judgeAttempts: number; initProbe: number; at: string; note?: string }[] })
    : { calls: 0, runs: [] };
  for (const t of targets) {
    const reportFile = path.join(results, 'reports', `${safe(t.id)}.json`);
    if (fs.existsSync(reportFile)) continue;
    const projectedHere = (dryCount.perTarget.find((x) => x.id === t.id)?.newEntries ?? 0) + 1;
    if (ledger.calls + projectedHere > budget) {
      process.stdout.write(`budget: ${String(ledger.calls)} used, ${t.id} needs ~${String(projectedHere)}; stopping before it\n`);
      writeJson(ledgerFile, ledger);
      return 4;
    }
    const before = entryFiles(cas);
    const r = evaluate(t.projectDir, t.specPath, ['--llm-provider', 'claude-cli', '--cassette-mode', 'record', '--cassette-dir', cas, '--judge-baseline-report', path.join(work, 'baseline', `${safe(t.id)}.json`)]);
    const after = entryFiles(cas);
    let attempts = 0;
    for (const [k, a] of after) if (!before.has(k)) attempts += a;
    const preflightFailed = /LLM_CLI_VERSION_DRIFT|LLM_CLI_ISOLATION|LLM_CONFIG_INVALID/.test(r.stderr);
    const initProbe = preflightFailed ? 0 : 1;
    ledger.calls += attempts + initProbe;
    const rep = parseReport(r.stdout);
    const incomplete = /JUDGE_RUN_INCOMPLETE|USAGE_LIMIT/.test(r.stderr) || rep === null;
    ledger.runs.push({ id: t.id, exit: r.status, judgeAttempts: attempts, initProbe, at: new Date().toISOString(), ...(incomplete ? { note: r.stderr.slice(-600).replace(/\/(Users|Volumes|private)\/[^\s'"]*/g, '<path>') } : {}) });
    writeJson(ledgerFile, ledger);
    process.stderr.write(`${t.id}: exit ${String(r.status)}, +${String(attempts)} judge attempts, ledger ${String(ledger.calls)}\n`);
    if (incomplete) {
      process.stdout.write(`${t.id}: run incomplete (usage limit or stop); rerun record to resume\n`);
      return 3;
    }
    writeJson(reportFile, rep);
  }
  process.stdout.write(`record complete; ledger ${String(ledger.calls)} calls\n`);
  return 0;
}

function replay(work: string, argv: readonly string[]): number {
  const cas = path.resolve(REPO, arg(argv, '--cassettes', 'tests/fixtures/judge-cassettes-v13/judge-catch'));
  const { targets } = readJson(path.join(work, 'plan.json')) as { targets: Target[] };
  let failed = 0;
  for (const t of targets) {
    const r = evaluate(t.projectDir, t.specPath, ['--llm-provider', 'claude-cli', '--cassette-mode', 'replay', '--cassette-dir', cas, '--judge-baseline-report', path.join(work, 'baseline', `${safe(t.id)}.json`)]);
    const rep = parseReport(r.stdout);
    if (rep === null) {
      failed++;
      process.stderr.write(`${t.id}: replay failed (exit ${String(r.status)}): ${r.stderr.slice(-400)}\n`);
      continue;
    }
    writeJson(path.join(work, 'replay', `${safe(t.id)}.json`), rep);
  }
  process.stdout.write(`replay: ${String(targets.length - failed)}/${String(targets.length)} ok\n`);
  return failed === 0 ? 0 : 1;
}

export function main(argv: readonly string[]): number {
  const [phase, work] = argv;
  if (phase === undefined || work === undefined) {
    process.stderr.write('usage: judge-catch-run.ts <full-mock|plan|dry|record|replay> <work> [options]\n');
    return 2;
  }
  const w = path.resolve(work);
  const onlyArg = arg(argv, '--only', '');
  const only = onlyArg === '' ? null : new Set(onlyArg.split(','));
  switch (phase) {
    case 'full-mock': return fullMock(w, only);
    case 'plan': return plan(w);
    case 'dry': return dry(w);
    case 'record': return record(w, argv);
    case 'replay': return replay(w, argv);
    default:
      process.stderr.write(`unknown phase ${phase}\n`);
      return 2;
  }
}

if (process.argv[1]?.endsWith('judge-catch-run.ts') === true) process.exitCode = main(process.argv.slice(2));
