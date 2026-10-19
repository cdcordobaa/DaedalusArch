/**
 * Declared-refactor validity study, step 2: run the tool before and after every selected refactor and control
 * (Docs/DiagnosticRuns/v1.3-validity-refactor-pr-plan.md §5). The pipeline runs in process exactly as
 * `firewall evaluate --symbolic-only --engine cypher-interp` (v1.3 scoring, instrument v2) against the frozen spec; the
 * two cycle query texts are answered by `FastCycleRepository` (parity-checked on snapshots of at most 100 files).
 * No Neo4j, no LLM. Entry file: no exports.
 *
 * Usage (repository root):
 *   node --max-old-space-size=6144 --import tsx scripts/v1.3/refactor-pr-run.ts run --repos <dir> --id <id> [--cache <dir>]
 *   node --import tsx scripts/v1.3/refactor-pr-run.ts validate --repos <dir> --id <id>
 *   node --import tsx scripts/v1.3/refactor-pr-run.ts cli-check --repos <dir> [--n 10] [--max-files 300]
 * Writes results/v1.3-validity-refactor-pr/{runs/<id>.json, validate/<id>.txt, cli-check.json}.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import ts from 'typescript';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { FastCycleRepository, type FastCycleStats } from './lib/fast-cycles.js';
import { violationKey } from './lib/fixes-mined.js';
import { flattenTsconfig } from './lib/wild.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-validity-refactor-pr');
const HARNESS = 'tsconfig.mined.json';
const CYCLE_CAP = 100;

interface CorpusEntry {
  readonly id: string; readonly repo: string; readonly sha: string; readonly root: string; readonly tsconfig: string;
  readonly include?: string[]; readonly historyPath?: string; readonly spec: string;
}

function git(cwd: string, args: readonly string[], allowFail = false): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.status === 0 ? r.stdout : '';
}
const posix = (p: string): string => p.split(path.sep).join('/');

function writeHarness(clone: string, root: string, e: CorpusEntry): void {
  const reader = {
    read: (p: string): Record<string, unknown> | undefined => {
      if (!fs.existsSync(p)) return undefined;
      const r = ts.readConfigFile(p, (f) => fs.readFileSync(f, 'utf8'));
      return r.error !== undefined ? undefined : (r.config as Record<string, unknown>);
    },
    resolvePackage: (spec: string): string | undefined => {
      const parts = spec.split('/');
      const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0] ?? '';
      const rest = parts.slice(spec.startsWith('@') ? 2 : 1).join('/');
      for (const f of git(clone, ['ls-files', '*package.json'], true).split('\n').filter(Boolean)) {
        const abs = path.join(clone, f);
        if (!fs.existsSync(abs)) continue;
        try {
          if ((JSON.parse(fs.readFileSync(abs, 'utf8')) as { name?: string }).name === name) {
            const target = path.join(path.dirname(abs), rest === '' ? 'tsconfig.json' : rest);
            return fs.existsSync(target) ? target : undefined;
          }
        } catch { /* not JSON */ }
      }
      return undefined;
    },
  };
  const flat = flattenTsconfig(path.join(root, e.tsconfig), root, reader, e.include);
  flat.tsconfig.compilerOptions.experimentalDecorators ??= true;
  fs.writeFileSync(path.join(root, HARNESS), JSON.stringify(flat.tsconfig, null, 2) + '\n');
}

function programFiles(root: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(root, HARNESS), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  return (parsed?.fileNames ?? []).map((f) => posix(path.relative(root, f))).filter((f) => !f.endsWith('.d.ts'));
}

interface Snap {
  readonly tree: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly files: number;
  readonly layered: number;
  /** Distinct blocking findings (violationKey), by rule. */
  readonly blocking: Record<string, number>;
  readonly advisory: Record<string, number>;
  /** Blocking finding keys (for the per-rule tables and the CLI check). */
  readonly blockingKeys: string[];
  readonly ms: number;
  readonly cycles?: FastCycleStats;
}

/** Sparse checkout: root-level files, the analysis root, and every package.json / tsconfig*.json (tsconfig chains). */
function sparse(clone: string, e: CorpusEntry): void {
  const pats = e.root === '.' ? ['/*'] : ['/*', '!/*/', `/${e.root}/`, 'package.json', 'tsconfig*.json', '/packages/config/'];
  git(clone, ['sparse-checkout', 'set', '--no-cone', ...pats]);
}

function checkout(clone: string, sha: string): void {
  git(clone, ['checkout', '-f', '-q', '--detach', sha]);
}

async function evaluateAt(clone: string, e: CorpusEntry, sha: string, tree: string): Promise<Snap> {
  const t0 = performance.now();
  checkout(clone, sha);
  const root = path.join(clone, e.root);
  const empty = (error: string): Snap => ({ tree, ok: false, error, files: 0, layered: 0, blocking: {}, advisory: {}, blockingKeys: [], ms: Math.round(performance.now() - t0) });
  if (!fs.existsSync(root)) return empty('analysis root absent');
  writeHarness(clone, root, e);
  const files = programFiles(root);
  if (files.length === 0) return empty('no source files');
  const repo = new FastCycleRepository(files.length <= 100);
  const config: PipelineConfig = {
    projectPath: root,
    specFilePath: path.join(REPO, e.spec),
    neo4jUri: 'bolt://unused', neo4jUser: 'neo4j', neo4jPassword: '',
    evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless',
    persist: false, diff: false, verbose: false,
    apgStorePath: path.join(clone, '..', `.apg-store-${e.id}`),
    tsconfigPath: path.join(root, HARNESS),
    instrumentVersion: 2,
    neuralAggregation: 'registered',
    scoringMode: 'v1.3',
    graphEngine: 'cypher-interp',
    graphRepository: repo,
  };
  const { executor, cleanup } = createPipeline({ ...config, postSealRules: false }); // v1.4 U2: the sealed v1.3 rule set (BR-U2-10)
  try {
    const result = await executor.execute();
    if (!result.success) return empty(`pipeline: ${result.errors.map((x) => x.message).join('; ').slice(0, 400)}`);
    const report = result.data;
    const tier = new Map<string, 'blocking' | 'advisory'>();
    for (const r of report.tiers?.blocking.rules ?? []) tier.set(r.functionId, 'blocking');
    for (const r of report.tiers?.advisory.rules ?? []) tier.set(r.functionId, 'advisory');
    let layered = 0;
    for (const n of repo.graph.nodes) {
      if (!n.labels.has('File')) continue;
      const layer = n.properties.get('layer');
      if (typeof layer === 'string' && layer !== '') layered++;
    }
    const seen = new Set<string>();
    const blocking: Record<string, number> = {};
    const advisory: Record<string, number> = {};
    const blockingKeys: string[] = [];
    for (const v of report.violations) {
      if (v.route !== 'symbolic') continue;
      const mv = { functionId: v.functionId, filePath: v.filePath, ...(v.target !== undefined && { target: v.target }), ...(v.discriminator !== undefined && { discriminator: [...v.discriminator] }) };
      const k = violationKey(mv);
      if (seen.has(k)) continue;
      seen.add(k);
      if ((tier.get(v.functionId) ?? 'advisory') === 'blocking') {
        blocking[v.functionId] = (blocking[v.functionId] ?? 0) + 1;
        blockingKeys.push(k);
      } else advisory[v.functionId] = (advisory[v.functionId] ?? 0) + 1;
    }
    return { tree, ok: true, files: files.length, layered, blocking, advisory, blockingKeys: blockingKeys.sort(), ms: Math.round(performance.now() - t0), cycles: repo.stats };
  } catch (err) {
    return empty(`exception: ${err instanceof Error ? err.message.slice(0, 400) : String(err)}`);
  } finally {
    await cleanup();
  }
}

interface SelectionSet {
  refactor: { sha: string; parent: string };
  controls: { sha: string; parent: string }[];
}

function loadCorpus(): CorpusEntry[] {
  return (JSON.parse(fs.readFileSync(path.join(OUT, 'corpus.json'), 'utf8')) as { entries: CorpusEntry[] }).entries;
}

async function run(reposDir: string, e: CorpusEntry, cacheDir: string): Promise<void> {
  const clone = path.join(reposDir, e.id);
  const sel = JSON.parse(fs.readFileSync(path.join(OUT, 'selection', `${e.id}.json`), 'utf8')) as { sets: SelectionSet[] };
  const sets = sel.sets.filter((s) => s.controls.length > 0);
  const hp = e.historyPath ?? e.root;
  const tsconfigPath = posix(path.join(e.root, e.tsconfig));
  const treeOf = (sha: string): string => {
    const tree = git(clone, ['rev-parse', '-q', '--verify', `${sha}:${hp === '.' ? '' : hp}`], true).trim();
    if (tree === '') return 'absent';
    const cfg = git(clone, ['rev-parse', '-q', '--verify', `${sha}:${tsconfigPath}`], true).trim();
    return cfg === '' ? tree : `${tree}-${cfg.slice(0, 12)}`;
  };
  const cdir = path.join(cacheDir, e.id);
  fs.mkdirSync(cdir, { recursive: true });
  // Sparse checkout of the analysis root (plus root-level files, for tsconfig chains and workspace package.json).
  sparse(clone, e);
  const t0 = performance.now();
  let evaluated = 0;
  const snapshot = async (sha: string): Promise<Snap> => {
    const tree = treeOf(sha);
    const f = path.join(cdir, `${tree}.json.gz`);
    if (fs.existsSync(f)) return JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')) as Snap;
    const s: Snap = tree === 'absent'
      ? { tree, ok: false, error: 'analysis root absent', files: 0, layered: 0, blocking: {}, advisory: {}, blockingKeys: [], ms: 0 }
      : await evaluateAt(clone, e, sha, tree);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(s)));
    evaluated++;
    return s;
  };
  const commits: Record<string, { parent: Snap; child: Snap }> = {};
  const todo = sets.flatMap((s) => [s.refactor, ...s.controls]);
  for (const [i, c] of todo.entries()) {
    if (commits[c.sha] !== undefined) continue;
    const parent = await snapshot(c.parent);
    const child = await snapshot(c.sha);
    commits[c.sha] = { parent, child };
    process.stdout.write(`${e.id}\t${String(i + 1)}/${String(todo.length)}\t${String(Math.round((performance.now() - t0) / 1000))}s\t${String(parent.files)}f\tB ${String(sum(parent.blocking))}->${String(sum(child.blocking))}\t${parent.error ?? ''}${child.error ?? ''}\n`);
  }
  const strip = (s: Snap): Omit<Snap, 'blockingKeys'> & { blockingKeyCount: number } => {
    const { blockingKeys, ...rest } = s;
    return { ...rest, blockingKeyCount: blockingKeys.length };
  };
  const doc = {
    id: e.id, engine: 'cypher-interp', mode: 'symbolic-only', scoring: 'v1.3', cycleCap: CYCLE_CAP,
    evaluated, wallSeconds: Math.round((performance.now() - t0) / 1000),
    commits: Object.fromEntries(Object.entries(commits).map(([k, v]) => [k, { parent: strip(v.parent), child: strip(v.child) }])),
  };
  fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'runs', `${e.id}.json`), JSON.stringify(doc, null, 1) + '\n');
  git(clone, ['checkout', '-f', '-q', '--detach', e.sha], true);
  fs.rmSync(path.join(clone, e.root, HARNESS), { force: true });
  process.stdout.write(`${e.id}\tdone\t${String(evaluated)} evaluated\t${String(doc.wallSeconds)}s\n`);
}

const sum = (r: Record<string, number>): number => Object.values(r).reduce((s, x) => s + x, 0);

function validate(reposDir: string, e: CorpusEntry): void {
  const clone = path.join(reposDir, e.id);
  sparse(clone, e);
  checkout(clone, e.sha);
  const r = spawnSync('npx', ['tsx', 'src/cli/bin.ts', 'validate', '--spec', e.spec, '--project', path.join(clone, e.root), '--engine', 'cypher-interp'], { cwd: REPO, encoding: 'utf8' });
  fs.mkdirSync(path.join(OUT, 'validate'), { recursive: true });
  const text = `# firewall validate --spec ${e.spec} --project <clone>/${e.root} --engine cypher-interp  (pin ${e.sha})\n# exit ${String(r.status)}\n${(r.stdout + r.stderr).split(clone).join('<clone>')}`;
  fs.writeFileSync(path.join(OUT, 'validate', `${e.id}.txt`), text);
  process.stdout.write(`${e.id}\tvalidate exit ${String(r.status)}\n`);
}

/** Plan §5: the first n refactor parents (pool order) of at most maxFiles files, through the CLI; blocking keys must match. */
async function cliCheck(reposDir: string, n: number, maxFiles: number, cacheDir: string): Promise<void> {
  const rows: unknown[] = [];
  for (const e of loadCorpus()) {
    if (rows.length >= n) break;
    const runFile = path.join(OUT, 'runs', `${e.id}.json`);
    if (!fs.existsSync(runFile)) continue;
    const runs = JSON.parse(fs.readFileSync(runFile, 'utf8')) as { commits: Record<string, { parent: { ok: boolean; files: number; tree: string } }> };
    const sel = JSON.parse(fs.readFileSync(path.join(OUT, 'selection', `${e.id}.json`), 'utf8')) as { sets: SelectionSet[] };
    for (const s of sel.sets) {
      if (rows.length >= n) break;
      const p = runs.commits[s.refactor.sha]?.parent;
      if (p === undefined || !p.ok || p.files > maxFiles) continue;
      const cached = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cacheDir, e.id, `${p.tree}.json.gz`))).toString('utf8')) as Snap;
      const clone = path.join(reposDir, e.id);
      sparse(clone, e);
      checkout(clone, s.refactor.parent);
      const root = path.join(clone, e.root);
      writeHarness(clone, root, e);
      const t0 = performance.now();
      const r = spawnSync('npx', ['tsx', 'src/cli/bin.ts', 'evaluate', root, '--spec', e.spec, '--format', 'json', '--symbolic-only', '--engine', 'cypher-interp', '--tsconfig', path.join(root, HARNESS)], { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, timeout: 30 * 60 * 1000 });
      let cliKeys: string[] | undefined;
      let error: string | undefined;
      try {
        const out = r.stdout.slice(r.stdout.indexOf('{'));
        const rep = JSON.parse(out) as { violations: { route: string; functionId: string; filePath: string; target?: string; discriminator?: string[] }[]; tiers?: { blocking: { rules: { functionId: string }[] } } };
        const blockingRules = new Set((rep.tiers?.blocking.rules ?? []).map((x) => x.functionId));
        cliKeys = [...new Set(rep.violations.filter((v) => v.route === 'symbolic' && blockingRules.has(v.functionId)).map((v) => violationKey({ functionId: v.functionId, filePath: v.filePath, ...(v.target !== undefined && { target: v.target }), ...(v.discriminator !== undefined && { discriminator: v.discriminator }) })))].sort();
      } catch (err) {
        error = `exit ${String(r.status)} signal ${String(r.signal)}: ${err instanceof Error ? err.message : String(err)} ${r.stderr.slice(-300)}`;
      }
      fs.rmSync(path.join(root, HARNESS), { force: true });
      const same = cliKeys !== undefined && cliKeys.length === cached.blockingKeys.length && cliKeys.every((k, i) => k === cached.blockingKeys[i]);
      rows.push({ id: e.id, sha: s.refactor.parent, files: p.files, inProcess: cached.blockingKeys.length, cli: cliKeys?.length ?? null, identicalKeys: same, ...(error !== undefined && { error }), ...(!same && cliKeys !== undefined && { onlyCli: cliKeys.filter((k) => !cached.blockingKeys.includes(k)).slice(0, 10), onlyInProcess: cached.blockingKeys.filter((k) => !cliKeys.includes(k)).slice(0, 10) }), cliSeconds: Math.round((performance.now() - t0) / 1000) });
      process.stdout.write(`${e.id}\t${s.refactor.parent.slice(0, 10)}\tin-process ${String(cached.blockingKeys.length)}\tcli ${String(cliKeys?.length)}\t${String(same)}\n`);
      checkout(clone, e.sha);
    }
  }
  fs.writeFileSync(path.join(OUT, 'cli-check.json'), JSON.stringify({ n, maxFiles, rows }, null, 1) + '\n');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const at = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const cmd = argv[0];
  const reposDir = at('repos');
  if (reposDir === undefined || (cmd !== 'run' && cmd !== 'validate' && cmd !== 'cli-check')) {
    process.stderr.write('usage: refactor-pr-run.ts run|validate|cli-check --repos <dir> [--id <id>] [--cache <dir>]\n');
    process.exitCode = 2;
    return;
  }
  const cache = path.resolve(at('cache') ?? path.join(reposDir, '..', 'snapcache-refactor'));
  if (cmd === 'cli-check') { await cliCheck(path.resolve(reposDir), Number(at('n') ?? '10'), Number(at('max-files') ?? '300'), cache); return; }
  const id = at('id');
  for (const e of loadCorpus().filter((x) => id === undefined || x.id === id)) {
    if (cmd === 'validate') validate(path.resolve(reposDir), e);
    else await run(path.resolve(reposDir), e, cache);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
