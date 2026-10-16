/**
 * v1.3 validity from developer behaviour: walk each repository's history and record which findings its maintainers
 * removed (Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md). No Neo4j, no LLM: the pipeline runs in
 * process, `--symbolic-only` with the in-process Cypher interpreter (`--engine cypher-interp`), v1.3 tiers, against the
 * layer spec committed for the project before this script first ran (results/v1.3-fixes-mined/specs/).
 * Entry file: no exports.
 *
 * Usage (repository root; clones under a temporary directory, never committed):
 *   node --max-old-space-size=6144 --import tsx scripts/v1.3/fixes-mined-run.ts walk --repos <dir> --id <id> [--n 200] [--cache <dir>]
 *
 * Per repository:
 *   1. Commits: the first-parent history up to the pinned SHA that touches the analysis root, oldest first; up to
 *      `--n` (200) of them evenly spaced (`evenlySpaced`). A commit without a parent is skipped.
 *   2. Every sampled commit and its first parent is checked out (sparse, the analysis root only) and evaluated; one
 *      snapshot per root tree hash, cached under `--cache` (a scratch directory, never committed).
 *   3. Pair analysis (parent -> commit): findings that disappear, with their cause (`classifyDisappearance`), findings
 *      introduced, and the same disappearance statistic for every internal import edge the tool does not flag.
 *   4. Grid analysis (the sampled commits in order): the lineage of every finding and every import edge, for
 *      survival times.
 * `--corpus` (default results/v1.3-fixes-mined/corpus.json) and `--out` (default results/v1.3-fixes-mined) exist for the
 * runtime calibration on a project outside the corpus.
 * Writes results/v1.3-fixes-mined/repos/<id>/{walk.json, pairs.json.gz, lineages.json.gz}.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import ts from 'typescript';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { FastCycleRepository, type FastCycleStats } from './lib/fast-cycles.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { flattenTsconfig } from './lib/wild.js';
import {
  classifyDisappearance, edgeKey, evenlySpaced, isBotAuthor, isMassChange, violationEdges, violationFiles, violationKey,
  type Disappearance, type MinedViolation,
} from './lib/fixes-mined.js';

const REPO = process.cwd();
const OUT_ARG = process.argv.indexOf('--out');
const OUT = OUT_ARG >= 0 ? path.resolve(process.argv[OUT_ARG + 1] ?? '') : path.join(REPO, 'results/v1.3-fixes-mined');
const HARNESS = 'tsconfig.mined.json';

interface CorpusEntry {
  readonly id: string;
  readonly repo: string;
  readonly url: string;
  /** The pin: the history walked ends here. */
  readonly sha: string;
  /** Analysis root inside the clone ('.' for the repository root). */
  readonly root: string;
  /** The repository's tsconfig the harness tsconfig is flattened from, relative to the analysis root. */
  readonly tsconfig: string;
  readonly include?: string[];
  /** The path whose history is walked and whose tree keys the snapshot cache (default: `root`). */
  readonly historyPath?: string;
  readonly spec: string;
}

function arg(name: string, argv: readonly string[]): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const posix = (p: string): string => p.split(path.sep).join('/');
const writeJson = (p: string, v: unknown): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n');
};
const writeGz = (p: string, v: unknown): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, zlib.gzipSync(JSON.stringify(v), { level: 9 }));
};
const readGz = <T>(p: string): T => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8')) as T;

function git(cwd: string, args: readonly string[], allowFail = false): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.status === 0 ? r.stdout : '';
}

// ── Snapshots ───────────────────────────────────────────────────────────────

interface SnapViolation extends MinedViolation {
  readonly tier: 'blocking' | 'advisory';
  readonly line?: number | undefined;
  readonly message: string;
}

interface Snapshot {
  readonly tree: string;
  readonly ok: boolean;
  readonly error?: string;
  /** Source files of the harness program (analysis-root relative). */
  readonly files: string[];
  /** Layer of each file the spec places (file -> layer). */
  readonly layers: Record<string, string>;
  /** File-to-file IMPORTS / RE_EXPORTS edges (`s|t`). */
  readonly imports: string[];
  /** Every file pair joined by any APG relation (`s|t`, node files lifted). */
  readonly deps: string[];
  readonly violations: SnapViolation[];
  readonly ms: number;
  /** The harness repository's counters (lib/fast-cycles.ts): fast answers, fallbacks, parity checks. */
  readonly cycles?: FastCycleStats;
}

/** Harness tsconfig at the checked-out commit (the repository's own chain flattened; defaults when it has none). */
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
  // The harness never type-checks for diagnostics; a decorator project without the flag still parses.
  flat.tsconfig.compilerOptions.experimentalDecorators ??= true;
  fs.writeFileSync(path.join(root, HARNESS), JSON.stringify(flat.tsconfig, null, 2) + '\n');
}

function programFiles(root: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(root, HARNESS), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  return (parsed?.fileNames ?? []).map((f) => posix(path.relative(root, f))).filter((f) => !f.endsWith('.d.ts'));
}

async function evaluateAt(clone: string, e: CorpusEntry, sha: string, tree: string, parityMaxFiles: number): Promise<Snapshot> {
  const t0 = performance.now();
  git(clone, ['checkout', '-f', '-q', '--detach', sha]);
  const root = path.join(clone, e.root);
  const empty = (error: string): Snapshot => ({ tree, ok: false, error, files: [], layers: {}, imports: [], deps: [], violations: [], ms: Math.round(performance.now() - t0) });
  if (!fs.existsSync(root)) return empty('analysis root absent');
  writeHarness(clone, root, e);
  const files = programFiles(root);
  if (files.length === 0) return empty('no source files');
  const repo = new FastCycleRepository(files.length <= parityMaxFiles);
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
  const { executor, cleanup } = createPipeline(config);
  try {
    const result = await executor.execute();
    if (!result.success) return empty(`pipeline: ${result.errors.map((x) => x.message).join('; ').slice(0, 400)}`);
    const report = result.data;
    const tier = new Map<string, 'blocking' | 'advisory'>();
    for (const r of report.tiers?.blocking.rules ?? []) tier.set(r.functionId, 'blocking');
    for (const r of report.tiers?.advisory.rules ?? []) tier.set(r.functionId, 'advisory');
    const rel = (p: string): string => {
      const f = posix(p);
      const r = posix(root);
      return (f.startsWith(`${r}/`) ? f.slice(r.length + 1) : f).replace(/^\.\//, '');
    };
    const fileOf = new Map<number, string>();
    const layers: Record<string, string> = {};
    for (const n of repo.graph.nodes) {
      const fp = n.properties.get('filePath');
      if (typeof fp === 'string' && fp !== '') fileOf.set(n.id, rel(fp));
      if (n.labels.has('File') && typeof fp === 'string') {
        const layer = n.properties.get('layer');
        if (typeof layer === 'string' && layer !== '') layers[rel(fp)] = layer;
      }
    }
    const imports = new Set<string>();
    const deps = new Set<string>();
    for (const r of repo.graph.relationships) {
      const s = fileOf.get(r.start.id);
      const t = fileOf.get(r.end.id);
      if (s === undefined || t === undefined || s === t) continue;
      deps.add(edgeKey(s, t));
      if ((r.type === 'IMPORTS' || r.type === 'RE_EXPORTS') && r.start.labels.has('File') && r.end.labels.has('File')) imports.add(edgeKey(s, t));
    }
    const violations: SnapViolation[] = report.violations
      .filter((v) => v.route === 'symbolic')
      .map((v) => ({
        functionId: v.functionId,
        tier: tier.get(v.functionId) ?? 'advisory',
        filePath: v.filePath,
        ...(v.target !== undefined && { target: v.target }),
        ...(v.discriminator !== undefined && { discriminator: [...v.discriminator] }),
        ...(v.line !== undefined && { line: v.line }),
        message: v.message.slice(0, 300),
      }));
    return { tree, ok: true, files, layers, imports: [...imports].sort(), deps: [...deps].sort(), violations, ms: Math.round(performance.now() - t0), cycles: repo.stats };
  } catch (err) {
    return empty(`exception: ${err instanceof Error ? err.message.slice(0, 400) : String(err)}`);
  } finally {
    await cleanup();
  }
}

// ── Walk ────────────────────────────────────────────────────────────────────

interface CommitMeta { readonly sha: string; readonly parent: string; readonly date: string; readonly author: string; readonly bot: boolean; readonly message: string }

function commitMeta(clone: string, sha: string): CommitMeta {
  const out = git(clone, ['log', '-1', '--format=%P%x00%cI%x00%an%x00%ae%x00%B', sha]);
  const [parents = '', date = '', author = '', email = '', message = ''] = out.split('\0');
  return { sha, parent: parents.split(' ')[0] ?? '', date, author, bot: isBotAuthor(author, email), message: message.trim().slice(0, 2000) };
}

interface NameStatus { readonly changed: number; readonly renamedOrDeleted: number; readonly renamedFrom: Set<string>; readonly deleted: Set<string> }

function nameStatus(clone: string, e: CorpusEntry, parent: string, child: string): NameStatus {
  const prefix = e.root === '.' ? '' : `${e.root}/`;
  const hp = e.historyPath ?? e.root;
  const out = git(clone, ['diff', '--name-status', '-M50%', '-l5000', parent, child, '--', hp], true);
  const renamedFrom = new Set<string>();
  const deleted = new Set<string>();
  let changed = 0;
  let rd = 0;
  for (const line of out.split('\n')) {
    if (line === '') continue;
    const [st = '', a = '', ] = line.split('\t');
    changed++;
    const strip = (p: string): string => (p.startsWith(prefix) ? p.slice(prefix.length) : p);
    if (st.startsWith('R')) { renamedFrom.add(strip(a)); rd++; }
    else if (st === 'D') { deleted.add(strip(a)); rd++; }
  }
  return { changed, renamedOrDeleted: rd, renamedFrom, deleted };
}

/** One disappeared or introduced finding at a pair. */
interface PairFinding {
  readonly key: string;
  readonly functionId: string;
  readonly tier: 'blocking' | 'advisory';
  readonly edgeShaped: boolean;
  /** Cross-layer label `fromLayer>toLayer` of the edge (first edge for a cycle). */
  readonly layers?: string;
  readonly cause?: Disappearance;
  readonly filePath: string;
  readonly target?: string;
  readonly line?: number;
  readonly message: string;
}

interface EdgeStats {
  /** Edges present at the parent (exposure). */
  readonly exposed: number;
  /** Disappearances by cause. */
  readonly causes: Record<string, number>;
}

interface PairRecord {
  readonly sha: string;
  readonly parent: string;
  readonly date: string;
  readonly author: string;
  readonly bot: boolean;
  readonly mass: boolean;
  readonly changed: number;
  readonly renamedOrDeleted: number;
  readonly message: string;
  readonly parentOk: boolean;
  readonly childOk: boolean;
  /** Findings present at the parent, by rule (exposure). */
  readonly exposedByRule: Record<string, number>;
  /** Findings present at the child, by rule (the FF-S02 truncation check needs both sides). */
  readonly childByRule: Record<string, number>;
  readonly disappeared: PairFinding[];
  readonly introduced: PairFinding[];
  /** Baselines: every internal import edge at the parent that no finding rests on, split by kind. */
  readonly baseline: Record<'all' | 'layered' | 'crossLayer', EdgeStats>;
  /** Up to 30 baseline edges removed by a dev at this pair (examples and their messages are the pair's). */
  readonly baselineFixedSample: string[];
}

function edgeLayers(snap: Snapshot, e: string): string | undefined {
  const [s = '', t = ''] = e.split('|');
  const a = snap.layers[s];
  const b = snap.layers[t];
  return a !== undefined && b !== undefined ? `${a}>${b}` : undefined;
}

function analysePair(meta: CommitMeta, ns: NameStatus, parent: Snapshot, child: Snapshot): PairRecord {
  const mass = isMassChange({ changed: ns.changed, renamedOrDeleted: ns.renamedOrDeleted, rootFiles: parent.files.length });
  const childFiles = new Set(child.files);
  const childDeps = new Set(child.deps);
  const massOrBot = mass || meta.bot;
  const pv = new Map(parent.violations.map((v) => [violationKey(v), v]));
  const cv = new Map(child.violations.map((v) => [violationKey(v), v]));
  const exposedByRule: Record<string, number> = {};
  for (const v of pv.values()) exposedByRule[v.functionId] = (exposedByRule[v.functionId] ?? 0) + 1;
  const childByRule: Record<string, number> = {};
  for (const v of cv.values()) childByRule[v.functionId] = (childByRule[v.functionId] ?? 0) + 1;
  const toFinding = (key: string, v: SnapViolation, snap: Snapshot, cause?: Disappearance): PairFinding => {
    const edges = violationEdges(v);
    const layers = edges[0] !== undefined ? edgeLayers(snap, edges[0]) : undefined;
    return {
      key, functionId: v.functionId, tier: v.tier, edgeShaped: edges.length > 0,
      ...(layers !== undefined && { layers }), ...(cause !== undefined && { cause }),
      filePath: v.filePath, ...(v.target !== undefined && { target: v.target }), ...(v.line !== undefined && { line: v.line }),
      message: v.message,
    };
  };
  const disappeared: PairFinding[] = [];
  const introduced: PairFinding[] = [];
  if (parent.ok && child.ok) {
    for (const [k, v] of pv) {
      if (cv.has(k)) continue;
      const cause = classifyDisappearance({ files: violationFiles(v), edges: violationEdges(v), childFiles, childEdges: childDeps, renamedFrom: ns.renamedFrom, massOrBot });
      disappeared.push(toFinding(k, v, parent, cause));
    }
    for (const [k, v] of cv) if (!pv.has(k)) introduced.push(toFinding(k, v, child));
  }
  const flagged = new Set<string>();
  for (const v of parent.violations) for (const e of violationEdges(v)) flagged.add(e);
  const mk = (): { exposed: number; causes: Record<string, number> } => ({ exposed: 0, causes: {} });
  const base = { all: mk(), layered: mk(), crossLayer: mk() };
  const fixedSample: string[] = [];
  if (parent.ok && child.ok) {
    for (const e of parent.imports) {
      if (flagged.has(e)) continue;
      const [s = '', t = ''] = e.split('|');
      const ls = parent.layers[s];
      const lt = parent.layers[t];
      const kinds: ('all' | 'layered' | 'crossLayer')[] = ['all'];
      if (ls !== undefined && lt !== undefined) { kinds.push('layered'); if (ls !== lt) kinds.push('crossLayer'); }
      let cause: Disappearance | undefined;
      if (!childDeps.has(e)) cause = classifyDisappearance({ files: [s, t], edges: [e], childFiles, childEdges: childDeps, renamedFrom: ns.renamedFrom, massOrBot });
      for (const k of kinds) {
        base[k].exposed++;
        if (cause !== undefined) base[k].causes[cause] = (base[k].causes[cause] ?? 0) + 1;
      }
      if (cause === 'FIXED-BY-DEV' && fixedSample.length < 30) fixedSample.push(e);
    }
  }
  return {
    sha: meta.sha, parent: meta.parent, date: meta.date, author: meta.author, bot: meta.bot, mass, changed: ns.changed,
    renamedOrDeleted: ns.renamedOrDeleted, message: meta.message, parentOk: parent.ok, childOk: child.ok,
    exposedByRule, childByRule, disappeared, introduced, baseline: base, baselineFixedSample: fixedSample,
  };
}

/** Lineages over the grid of sampled commits (child snapshots, oldest first). */
interface Lineage {
  readonly key: string;
  readonly kind: 'finding' | 'edge';
  readonly functionId?: string;
  readonly tier?: 'blocking' | 'advisory';
  readonly edgeShaped?: boolean;
  /** For an edge: 'layered' | 'crossLayer' | 'other'. */
  readonly edgeKind?: string;
  /** Grid index first seen (0 = left-censored: present at the first grid point). */
  readonly born: number;
  /** Grid index of the first absence after `born`, or null (present at the last grid point). */
  readonly ended: number | null;
  /** At the end: whether every file it names is still present at the same path. */
  readonly filesStay?: boolean;
}

function lineages(grid: readonly Snapshot[]): Lineage[] {
  const out: Lineage[] = [];
  type Open = { born: number; v?: SnapViolation; edgeKind?: string };
  const openF = new Map<string, Open>();
  const openE = new Map<string, Open>();
  const close = (k: string, o: Open, kind: 'finding' | 'edge', ended: number | null, at?: Snapshot): void => {
    let filesStay: boolean | undefined;
    if (at !== undefined && ended !== null) {
      const fs2 = new Set(at.files);
      const files = kind === 'finding' && o.v !== undefined ? violationFiles(o.v) : k.split('|');
      filesStay = files.every((f) => fs2.has(f));
    }
    out.push(kind === 'finding' && o.v !== undefined
      ? { key: k, kind, functionId: o.v.functionId, tier: o.v.tier, edgeShaped: violationEdges(o.v).length > 0, born: o.born, ended, ...(filesStay !== undefined && { filesStay }) }
      : { key: k, kind, ...(o.edgeKind !== undefined && { edgeKind: o.edgeKind }), born: o.born, ended, ...(filesStay !== undefined && { filesStay }) });
  };
  grid.forEach((snap, i) => {
    if (!snap.ok) return; // a failed snapshot is skipped: neither a birth nor a death
    const fk = new Map(snap.violations.map((v) => [violationKey(v), v]));
    const flagged = new Set<string>();
    for (const v of snap.violations) for (const e of violationEdges(v)) flagged.add(e);
    for (const [k, o] of [...openF]) if (!fk.has(k)) { close(k, o, 'finding', i, snap); openF.delete(k); }
    for (const [k, v] of fk) if (!openF.has(k)) openF.set(k, { born: i, v });
    const ek = new Set(snap.imports.filter((e) => !flagged.has(e)));
    for (const [k, o] of [...openE]) if (!ek.has(k)) { close(k, o, 'edge', i, snap); openE.delete(k); }
    for (const k of ek) {
      if (openE.has(k)) continue;
      const [s = '', t = ''] = k.split('|');
      const a = snap.layers[s];
      const b = snap.layers[t];
      openE.set(k, { born: i, edgeKind: a !== undefined && b !== undefined ? (a !== b ? 'crossLayer' : 'layered') : 'other' });
    }
  });
  for (const [k, o] of openF) close(k, o, 'finding', null);
  for (const [k, o] of openE) close(k, o, 'edge', null);
  return out;
}

async function walk(reposDir: string, e: CorpusEntry, n: number, cacheDir: string, parityMaxFiles: number): Promise<void> {
  const clone = path.join(reposDir, e.id);
  const t0 = performance.now();
  const hp = e.historyPath ?? e.root;
  const pathspec = hp === '.' ? [] : ['--', hp];
  const all = git(clone, ['rev-list', '--first-parent', '--reverse', e.sha, ...pathspec]).split('\n').filter(Boolean);
  const withParent = all.filter((c) => git(clone, ['rev-parse', '-q', '--verify', `${c}^1`], true).trim() !== '');
  const sample = evenlySpaced(withParent, n);
  const cdir = path.join(cacheDir, e.id);
  fs.mkdirSync(cdir, { recursive: true });
  // Cache key: the tree of the walked path plus the blob of the tsconfig the harness is flattened from.
  const tsconfigPath = posix(path.join(e.root, e.tsconfig));
  const treeOf = (sha: string): string => {
    const tree = git(clone, ['rev-parse', '-q', '--verify', `${sha}:${hp === '.' ? '' : hp}`], true).trim();
    if (tree === '') return 'absent';
    const cfg = git(clone, ['rev-parse', '-q', '--verify', `${sha}:${tsconfigPath}`], true).trim();
    return cfg === '' ? tree : `${tree}-${cfg.slice(0, 12)}`;
  };
  let evaluated = 0;
  let cached = 0;
  const snapshot = async (sha: string): Promise<Snapshot> => {
    const tree = treeOf(sha);
    const f = path.join(cdir, `${tree}.json.gz`);
    if (fs.existsSync(f)) { cached++; return readGz<Snapshot>(f); }
    const s = tree === 'absent'
      ? { tree, ok: false, error: 'analysis root absent', files: [], layers: {}, imports: [], deps: [], violations: [], ms: 0 }
      : await evaluateAt(clone, e, sha, tree, parityMaxFiles);
    writeGz(f, s);
    evaluated++;
    return s;
  };
  const pairs: PairRecord[] = [];
  const grid: Snapshot[] = [];
  const gridMeta: { sha: string; date: string }[] = [];
  const errors: { sha: string; error: string }[] = [];
  for (const [i, c] of sample.entries()) {
    const meta = commitMeta(clone, c);
    const ps = await snapshot(meta.parent);
    const cs = await snapshot(c);
    if (!ps.ok && ps.error !== undefined) errors.push({ sha: meta.parent, error: ps.error });
    if (!cs.ok && cs.error !== undefined) errors.push({ sha: c, error: cs.error });
    const ns = nameStatus(clone, e, meta.parent, c);
    pairs.push(analysePair(meta, ns, ps, cs));
    grid.push(cs);
    gridMeta.push({ sha: c, date: meta.date });
    if (i % 10 === 0) process.stdout.write(`${e.id}\t${String(i + 1)}/${String(sample.length)}\tevaluated ${String(evaluated)} cached ${String(cached)}\t${String(Math.round((performance.now() - t0) / 1000))}s\t${String(cs.files.length)} files ${String(cs.violations.length)} findings ${cs.error ?? ''}\n`);
  }
  const dir = path.join(OUT, 'repos', e.id);
  const head = grid.at(-1);
  writeJson(path.join(dir, 'walk.json'), {
    id: e.id, repo: e.repo, pin: e.sha, root: e.root, spec: e.spec,
    firstParentCommitsTouchingRoot: all.length, sampled: sample.length,
    firstSampled: gridMeta[0], lastSampled: gridMeta.at(-1),
    snapshotsEvaluated: evaluated, snapshotCacheHits: cached,
    snapshotErrors: errors.length, errorSample: errors.slice(0, 10),
    atLastSample: head !== undefined ? { files: head.files.length, layeredFiles: Object.keys(head.layers).length, imports: head.imports.length, findings: head.violations.length } : null,
    wallSeconds: Math.round((performance.now() - t0) / 1000),
    engine: 'cypher-interp', mode: 'symbolic-only', scoring: 'v1.3',
  });
  writeGz(path.join(dir, 'pairs.json.gz'), pairs);
  writeGz(path.join(dir, 'lineages.json.gz'), { grid: gridMeta, lineages: lineages(grid) });
  // Leave the clone without a checkout (the harness file is untracked and removed).
  git(clone, ['checkout', '-f', '-q', '--detach', e.sha], true);
  fs.rmSync(path.join(clone, e.root, HARNESS), { force: true });
  process.stdout.write(`${e.id}\tdone\t${String(sample.length)} pairs\t${String(evaluated)} evaluated\t${String(Math.round((performance.now() - t0) / 1000))}s\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const reposDir = arg('repos', argv);
  const id = arg('id', argv);
  if (cmd !== 'walk' || reposDir === undefined || id === undefined) {
    process.stderr.write('usage: fixes-mined-run.ts walk --repos <dir> --id <id> [--n 200] [--cache <dir>] [--corpus <file>]\n');
    process.exitCode = 2;
    return;
  }
  const corpus = (JSON.parse(fs.readFileSync(arg('corpus', argv) ?? path.join(OUT, 'corpus.json'), 'utf8')) as { entries: CorpusEntry[] }).entries;
  const e = corpus.find((x) => x.id === id);
  if (e === undefined) throw new Error(`unknown id ${id}`);
  await walk(path.resolve(reposDir), e, Number(arg('n', argv) ?? '200'), path.resolve(arg('cache', argv) ?? path.join(reposDir, '..', 'snapcache')), Number(arg('parity-max-files', argv) ?? '100'));
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
