/**
 * Stage C per-rule exposure (registered 2026-10-20 in Docs/v1.4/exploratory-study-registration.md; definitions fixed in
 * Docs/v1.4/exposure-definitions.md, queries in `scripts/v1.4/lib/exposure.ts`). Entry file: no exports. Zero calls:
 * no model, no Neo4j (the in-process `cypher-interp` engine only). Descriptive only.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/exposure-count.ts --devset [--out results/v1.4-exposure-devset]
 *   npx tsx scripts/v1.4/exposure-count.ts --steps <dir> [--snapshots-root <out-root> ...] [--node-modules <dir>]
 *     --out <dir>
 *
 * Every snapshot is evaluated as the loop evaluator does (`evaluateProject`, scoring v1.3, engine cypher-interp, the
 * harness tsconfig); the graph repository is injected and the pipeline context kept, so the opportunity query of each
 * Layered blocking rule runs on the same evaluated graph and is derived from the same compiled Cypher the scorer ran.
 * Per snapshot and rule: opportunities, the scorer's violations, the rule's own rows, violations per opportunity, and
 * the row check (every violation row is an opportunity row). Zero opportunities = `not-exercised`, never conformant.
 *
 * `--devset`: the Layered v1.3 reference project and its variants (`tests/fixtures/v1.3-reference/layered`, each
 * materialised by `scripts/v1.3/lib/materialise.ts`), each with its own tsconfig and spec.
 * `--steps`: every `steps/step-NN.json` (schema loop-step/v1) under <dir>; each scored turn's `snapshot.commit` is
 * read from the run's `snapshots.git`: `<run dir>/snapshots.git`, else `<out-root>/runs/<runId>/snapshots.git` for
 * each `--snapshots-root`. The spec is the step's `evaluatorSpec` (static: repository-relative, its sha256 checked;
 * frozen-after-step-1: run-relative). The recomputed per-rule counts are compared with the step's recorded
 * `blockingByRule` (`recordedMatch`). `--node-modules` is linked into each materialised tree (the loop's skeleton).
 *
 * Reads (read-only): presets, the step records, the snapshot stores, tests/fixtures/v1.3-reference/layered.
 * Writes <out>/exposure.json (canonical JSON: params, one row per snapshot, aggregates per group and rule).
 * Exit codes: 0 ok; 1 a snapshot failed to evaluate, a row check failed or a recorded count differs; 2 usage error;
 * 3 some scored snapshot has no tree (listed as `no-tree`).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { canonicalize, ratio } from '../lib/canonical-json.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { loadReference } from '../v1.3/lib/reference-model.js';
import { materialiseVariant } from '../v1.3/lib/materialise.js';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { createInterpEvaluator } from '../../src/mcp-server/interp-evaluator.js';
import { evaluateProject } from '../../src/mcp-server/evaluate-project.js';
import type { FirewallContext } from '../../src/shared/context/firewall-context.js';
import { aggregate, blockingRules, ruleExposure, type RuleExposure, type RuleQuery } from './lib/exposure.js';

const REPO = process.cwd();
const STYLE = 'layered';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const args = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1] ?? ''] : []));

const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ── one evaluation, keeping the graph and the compiled queries ───────────────

interface Evaluated {
  readonly rules: RuleExposure[];
  readonly notCompiled: { ruleId: string; reason: string }[];
  readonly scorerByRule: Record<string, number>;
}

async function evaluateExposure(projectDir: string, specPath: string, tsconfigPath: string | undefined): Promise<Evaluated> {
  const repo = new MemoryGraphRepository();
  let context: FirewallContext | undefined;
  const interp = createInterpEvaluator({
    makePipeline: (config) => {
      const bundle = createPipeline({ ...config, graphRepository: repo });
      context = bundle.context;
      return bundle;
    },
  });
  const r = await evaluateProject(
    { projectPath: projectDir, specPath, scoringMode: 'v1.3', includeViolations: true, ...(tsconfigPath !== undefined ? { tsconfigPath } : {}) },
    {},
    { makeGraph: () => { throw new Error('exposure-count: Neo4j is never used'); }, makePipeline: createPipeline, graphEngine: 'cypher-interp', interp },
  );
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  if (context === undefined || r.data.tiers === undefined) throw new Error('no pipeline context or no v1.3 tiers');
  if (r.data.tiers.style !== STYLE) throw new Error(`spec style ${String(r.data.tiers.style)}, expected ${STYLE}`);
  const compiled = context.getCompiledFunctions();
  const queries: RuleQuery[] = compiled.symbolicQueries.map((q) => ({ functionId: String(q.functionId), name: q.name, cypher: q.cypher, params: q.params }));
  const disabled = compiled.disabledFunctions.map((d) => ({ id: String(d.id), reason: d.reason ?? '' }));
  const { compiled: blocking, notCompiled } = blockingRules(queries, disabled, STYLE);
  const scorerByRule: Record<string, number> = {};
  for (const row of r.data.tiers.blocking.rules) scorerByRule[String(row.functionId)] = (scorerByRule[String(row.functionId)] ?? 0) + row.violationCount;
  const rules: RuleExposure[] = [];
  for (const q of blocking) rules.push(await ruleExposure(repo, q, scorerByRule[q.functionId] ?? 0));
  return { rules, notCompiled, scorerByRule };
}

const ruleOut = (e: RuleExposure): Record<string, unknown> => ({
  ...e,
  violationsPerOpportunity: e.violationsPerOpportunity === null ? null : ratio(e.violationsPerOpportunity),
});
const aggOut = (a: ReturnType<typeof aggregate>[number]): Record<string, unknown> => ({
  ...a,
  violationsPerOpportunity: a.violationsPerOpportunity === null ? null : ratio(a.violationsPerOpportunity),
});
const rowOk = (e: RuleExposure): boolean => (e.rowsOutsideOpportunities ?? 0) === 0 && e.violations <= (e.opportunities ?? e.violations);

// ── development set ─────────────────────────────────────────────────────────

async function devset(out: string): Promise<number> {
  const ref = loadReference(REPO, 'layered');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'exposure-devset-'));
  const snapshots: Record<string, unknown>[] = [];
  const flat: { group: string; rule: RuleExposure }[] = [];
  let bad = 0;
  try {
    for (const v of [...ref.variants].sort((a, b) => (a.manifest.variant < b.manifest.variant ? -1 : 1))) {
      const m = materialiseVariant(ref, v, scratch);
      const e = await evaluateExposure(m.projectDir, ref.specPath, undefined);
      const ok = e.rules.every(rowOk);
      if (!ok) bad += 1;
      for (const rule of e.rules) flat.push({ group: 'layered-reference', rule });
      snapshots.push({ id: `layered/${m.variant}`, kind: v.manifest.kind, rules: e.rules.map(ruleOut), notCompiled: e.notCompiled, rowCheck: ok });
      process.stdout.write(`${m.variant}: ${e.rules.map((x) => `${x.ruleId} ${String(x.violations)}/${String(x.opportunities)}${x.status === 'not-exercised' ? ' NOT-EXERCISED' : ''}`).join(', ')}${ok ? '' : ' ROW-CHECK-FAILED'}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'exposure.json'), canonicalize({
    params: { mode: 'devset', reference: 'tests/fixtures/v1.3-reference/layered', spec: path.relative(REPO, ref.specPath), style: STYLE, engine: 'cypher-interp', scoringMode: 'v1.3', definitions: 'Docs/v1.4/exposure-definitions.md' },
    snapshots,
    aggregates: aggregate(flat).map(aggOut),
  }));
  return bad > 0 ? 1 : 0;
}

// ── loop step records ───────────────────────────────────────────────────────

interface StepRecord {
  readonly schema: string;
  readonly runId: string;
  readonly stepIndex: number;
  readonly evaluatorSpec?: { readonly kind: 'static' | 'frozen-after-step-1'; readonly path: string; readonly sha256?: string | null };
  readonly turns: readonly { readonly turnId: string; readonly snapshot?: { readonly commit: string; readonly evaluation?: { readonly blockingByRule?: Record<string, number> } | null } | null }[];
}

function stepFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    if (e.name === 'snapshots.git' || e.name === 'node_modules' || e.name === 'work') continue;
    if (e.name === 'steps') {
      for (const f of fs.readdirSync(p).filter((x) => /^step-\d\d\.json$/.test(x)).sort()) out.push(path.join(p, f));
    } else {
      out.push(...stepFiles(p));
    }
  }
  return out;
}

function findRunHome(runDir: string, runId: string, roots: readonly string[]): string | null {
  if (fs.existsSync(path.join(runDir, 'snapshots.git'))) return runDir;
  for (const r of roots) {
    for (const c of [path.join(r, 'runs', runId), path.join(r, runId)]) if (fs.existsSync(path.join(c, 'snapshots.git'))) return c;
  }
  return null;
}

function materialiseCommit(runHome: string, commit: string, tree: string, nodeModules: string | undefined): string {
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(tree, { recursive: true });
  const tar = execFileSync('git', ['--git-dir', path.join(runHome, 'snapshots.git'), 'archive', commit], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  if (nodeModules !== undefined && !fs.existsSync(path.join(tree, 'node_modules'))) fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
  const tsconfig = `${tree}.tsconfig.json`;
  fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
  return tsconfig;
}

const sameCounts = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? 0) === (b[k] ?? 0));
};

async function steps(stepsRoot: string, roots: readonly string[], nodeModules: string | undefined, out: string): Promise<number> {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'exposure-steps-'));
  const snapshots: Record<string, unknown>[] = [];
  const flat: { group: string; rule: RuleExposure }[] = [];
  let bad = 0;
  let noTree = 0;
  try {
    for (const file of stepFiles(stepsRoot)) {
      const rec = readJson<StepRecord>(file);
      if (rec.schema !== 'loop-step/v1') continue;
      const runDir = path.dirname(path.dirname(file));
      const runRel = path.relative(stepsRoot, runDir).split(path.sep).join('/');
      const group = path.posix.dirname(runRel);
      const runHome = findRunHome(runDir, rec.runId, roots);
      for (const t of rec.turns) {
        const snap = t.snapshot;
        if (snap?.evaluation === undefined || snap.evaluation === null) continue; // not a scored snapshot
        const id = `${runRel}/${t.turnId}`;
        const recorded = snap.evaluation.blockingByRule ?? {};
        const base = { id, group, runId: rec.runId, step: rec.stepIndex + 1, turnId: t.turnId, commit: snap.commit, recordedByRule: recorded };
        if (runHome === null) {
          noTree += 1;
          snapshots.push({ ...base, status: 'no-tree' });
          continue;
        }
        const spec = rec.evaluatorSpec;
        if (spec === undefined) {
          bad += 1;
          snapshots.push({ ...base, status: 'error', error: 'no evaluatorSpec' });
          continue;
        }
        const specPath = spec.kind === 'static' ? path.resolve(REPO, spec.path) : path.resolve(runHome, spec.path);
        if (!fs.existsSync(specPath) || (typeof spec.sha256 === 'string' && sha256(specPath) !== spec.sha256)) {
          bad += 1;
          snapshots.push({ ...base, status: 'spec-mismatch', spec: spec.path });
          continue;
        }
        try {
          const tree = path.join(scratch, 'tree');
          const tsconfig = materialiseCommit(runHome, snap.commit, tree, nodeModules);
          const e = await evaluateExposure(tree, specPath, tsconfig);
          const recordedMatch = sameCounts(recorded, e.scorerByRule);
          const ok = e.rules.every(rowOk);
          if (!ok || !recordedMatch) bad += 1;
          for (const rule of e.rules) flat.push({ group, rule });
          snapshots.push({ ...base, status: 'evaluated', spec: spec.path, rules: e.rules.map(ruleOut), notCompiled: e.notCompiled, rowCheck: ok, recordedMatch });
        } catch (err) {
          bad += 1;
          snapshots.push({ ...base, status: 'error', error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'exposure.json'), canonicalize({
    params: { mode: 'steps', steps: path.relative(REPO, path.resolve(stepsRoot)).split(path.sep).join('/'), snapshotsRoots: roots.length, nodeModules: nodeModules !== undefined, style: STYLE, engine: 'cypher-interp', scoringMode: 'v1.3', definitions: 'Docs/v1.4/exposure-definitions.md' },
    snapshots,
    aggregates: aggregate(flat).map(aggOut),
  }));
  const evaluated = snapshots.filter((s) => s.status === 'evaluated').length;
  process.stdout.write(`scored snapshots: ${String(snapshots.length)}, evaluated ${String(evaluated)}, no tree ${String(noTree)}, problems ${String(bad)}\n`);
  for (const a of aggregate(flat)) {
    process.stdout.write(`${a.group} ${a.ruleId}: ${String(a.violations)} violations / ${String(a.opportunities)} opportunities over ${String(a.exercised)} exercised snapshots, ${String(a.notExercised)} not exercised\n`);
  }
  if (bad > 0) return 1;
  return noTree > 0 ? 3 : 0;
}

async function main(): Promise<number> {
  if (argv.includes('--devset')) return devset(path.resolve(arg('out') ?? 'results/v1.4-exposure-devset'));
  const stepsRoot = arg('steps');
  const out = arg('out');
  if (stepsRoot === undefined || out === undefined) {
    process.stderr.write('usage: exposure-count.ts --devset [--out <dir>] | --steps <dir> [--snapshots-root <dir> ...] [--node-modules <dir>] --out <dir>\n');
    return 2;
  }
  const nm = arg('node-modules');
  return steps(path.resolve(stepsRoot), args('snapshots-root').map((r) => path.resolve(r)), nm !== undefined ? path.resolve(nm) : undefined, path.resolve(out));
}

main().then((code) => { process.exitCode = code; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 1;
});
