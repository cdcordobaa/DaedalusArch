/**
 * Entry logic of `scripts/v1.3/holdout-run.ts`: the one-time hold-out run of Docs/v1.3/holdout-prespec.md, from the
 * structure check to the claim levels.
 *
 * Modes:
 *   --dry-run                 check the hold-out directory's structure only (schemas, cross-checks, id mapping,
 *                             every patch or overlay applied to a temporary copy, counts, location, tree hash);
 *                             the tool is not run and Neo4j is not needed
 *   (default, live)           dry-run checks, then the freeze check (the working tree's src/ scripts/ presets/
 *                             specs/ equal --commit, nothing untracked), then the prespec §2 pipeline:
 *                             `ue-baseline-live.ts --root <holdout>` (validate-reference live, Neo4j, cross-process
 *                             lock), `ue-graph.ts --root <holdout>`, `check-correct` on the blocking findings, then
 *                             the scoring of prespec §3–§5
 *   --from-raw <run dir>      score an existing run directory (raw/, evidence/, graph/) instead of running the tool:
 *                             for a second manifest set (author vs blind) over the same outputs, or a re-score
 *
 * Options: --holdout <dir> (required)  --commit <sha> (required unless --dry-run)  --out <dir>  --id-map <file>
 *   --deferred <FF-xx,...>  --graph-adjudication <file>  --style <a,b>  --expect-sha256 <hex>  --no-correctness
 *   --determinism <other run dir> (compare the raw rows of a repeat run; a difference is a defect, prespec §2.3)
 *   --development-stand-in (allow a hold-out directory inside the repository, i.e. the development reference set,
 *   to test the runner; every output is then headed as a stand-in and is never a validity figure)
 *
 * Exit codes: 0 ok, 1 a check failed, 2 usage or environment.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTempRoot, materialiseVariant } from './materialise.js';
import {
  OVERLAY_REFERENCE_STYLES, REFERENCE_STYLES, applyRuleIdMap, crossCheck, isReferenceStyle, loadReference, loadRuleIdMap,
} from './reference-model.js';
import type { LoadedReference, ReferenceStyle, RuleIdMapFile } from './reference-model.js';
import type { ActualFinding } from './compare.js';
import { claimLines, renderHoldoutMarkdown, scoreHoldout, scoresJson, minPerfectN, RECALL_TARGET } from './holdout-score.js';
import type { CorrectnessRow, GraphAdjudication, ToolGraph } from './holdout-score.js';
import { checkMain } from './labelling/mains.js';
import type { LabellingJob } from './labelling/findings.js';

export interface HoldoutIo {
  readonly env: NodeJS.ProcessEnv;
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
}

/** Runs a child (`node <args>`, cwd the repository root, inheriting stdio); returns its exit code. */
export type NodeSpawner = (args: readonly string[], env: NodeJS.ProcessEnv) => number;
/** Runs `git <args>` in the repository; returns stdout, throws on a non-zero exit. */
export type GitRunner = (args: readonly string[]) => string;

export interface HoldoutDeps {
  readonly spawnNode?: NodeSpawner;
  readonly git?: GitRunner;
  /** Clock for the provenance file. */
  readonly now?: () => Date;
}

export const FROZEN_PATHS = ['src', 'scripts', 'presets', 'specs'] as const;

export interface HoldoutArgs {
  readonly mode: 'dry-run' | 'live' | 'from-raw';
  readonly holdout: string;
  readonly commit?: string;
  readonly out?: string;
  readonly fromRaw?: string;
  readonly idMap?: string;
  readonly deferred: readonly string[];
  readonly graphAdjudication?: string;
  readonly styles?: readonly ReferenceStyle[];
  readonly expectSha256?: string;
  readonly correctness: boolean;
  readonly determinism?: string;
  readonly standIn: boolean;
}

export function parseHoldoutArgs(argv: readonly string[]): HoldoutArgs | string {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (!a.startsWith('--')) return `unexpected argument ${JSON.stringify(a)}`;
    const flag = ['--dry-run', '--no-correctness', '--development-stand-in'].includes(a);
    if (flag) m.set(a.slice(2), 'true');
    else {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return `${a} needs a value`;
      m.set(a.slice(2), v);
      i += 1;
    }
  }
  const known = new Set(['dry-run', 'no-correctness', 'development-stand-in', 'holdout', 'commit', 'out', 'from-raw', 'id-map', 'deferred', 'graph-adjudication', 'style', 'expect-sha256', 'determinism']);
  for (const k of m.keys()) if (!known.has(k)) return `unknown option --${k}`;
  const holdout = m.get('holdout');
  if (holdout === undefined) return '--holdout <dir> is required';
  const dry = m.has('dry-run');
  const fromRaw = m.get('from-raw');
  if (dry && fromRaw !== undefined) return 'choose one of --dry-run and --from-raw';
  const mode: HoldoutArgs['mode'] = dry ? 'dry-run' : fromRaw !== undefined ? 'from-raw' : 'live';
  const commit = m.get('commit');
  if (mode !== 'dry-run' && commit === undefined) return '--commit <frozen tool sha> is required (prespec §1)';
  const out = m.get('out');
  if (mode !== 'dry-run' && out === undefined) return '--out <dir> is required';
  let styles: ReferenceStyle[] | undefined;
  const st = m.get('style');
  if (st !== undefined) {
    const list = st.split(',').filter((s) => s !== '');
    if (list.length === 0 || !list.every(isReferenceStyle)) return `--style takes a comma list of ${REFERENCE_STYLES.join(', ')}`;
    styles = list;
  }
  const deferred = (m.get('deferred') ?? '').split(',').filter((s) => s !== '');
  if (!deferred.every((d) => /^FF-[A-Z]+[0-9]{2}$/.test(d))) return '--deferred takes a comma list of rule ids';
  const sha = m.get('expect-sha256');
  if (sha !== undefined && !/^[0-9a-f]{64}$/.test(sha)) return '--expect-sha256 takes 64 hex characters';
  const idMap = m.get('id-map');
  const graphAdjudication = m.get('graph-adjudication');
  const determinism = m.get('determinism');
  return {
    mode, holdout, deferred, correctness: !m.has('no-correctness'), standIn: m.has('development-stand-in'),
    ...(commit !== undefined && { commit }), ...(out !== undefined && { out }), ...(fromRaw !== undefined && { fromRaw }),
    ...(idMap !== undefined && { idMap }), ...(graphAdjudication !== undefined && { graphAdjudication }),
    ...(styles !== undefined && { styles }), ...(sha !== undefined && { expectSha256: sha }), ...(determinism !== undefined && { determinism }),
  };
}

// ── Tree hash and location ────────────────────────────────────────────────────

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  walk(root);
  return out.sort((a, b) => (Buffer.from(a) < Buffer.from(b) ? -1 : a === b ? 0 : 1));
}

/**
 * sha256 of the directory's file list with each file's sha256, the same value as
 * `(cd <dir> && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) | sha256sum`.
 */
export function treeSha256(root: string): { sha256: string; files: number } {
  const files = listFiles(root);
  const h = createHash('sha256');
  for (const f of files) h.update(`${createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')}  ./${f}\n`);
  return { sha256: h.digest('hex'), files: files.length };
}

/** Prespec §2.1: the unsealed hold-out lies outside the repository and outside any node_modules ancestry. */
export function locationProblems(holdout: string, repoRoot: string): string[] {
  const abs = path.resolve(holdout);
  const real = fs.existsSync(abs) ? fs.realpathSync(abs) : abs;
  const repo = fs.realpathSync(repoRoot);
  const problems: string[] = [];
  if (real === repo || real.startsWith(repo + path.sep)) problems.push(`the hold-out directory ${real} is inside the repository`);
  if (real.split(path.sep).includes('node_modules')) problems.push(`the hold-out directory ${real} has a node_modules ancestor`);
  return problems;
}

// ── Structure check (dry run) ─────────────────────────────────────────────────

export interface StyleStructure {
  readonly style: ReferenceStyle;
  readonly format: 'patch' | 'overlay';
  readonly variants: { readonly violation: number; readonly nearMiss: number; readonly clean: number };
  readonly expectedFindings: number;
  readonly expectedBlocking: number;
  readonly mappedIds: Readonly<Record<string, number>>;
  readonly graphFiles: number;
  readonly graphEdges: number;
}

export interface StructureReport {
  readonly holdout: string;
  readonly tree: { readonly sha256: string; readonly files: number };
  readonly styles: readonly StyleStructure[];
  readonly missingStyles: readonly ReferenceStyle[];
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly refs: readonly LoadedReference[];
}

const REQUIRED: Readonly<Record<'patch' | 'overlay', readonly string[]>> = {
  patch: ['reference.json', 'expected-graph.json', 'project', 'variants'],
  overlay: ['expected-graph.json', 'clean', 'clean/expected-findings.json', 'variants'],
};

export function checkStructure(repoRoot: string, args: Pick<HoldoutArgs, 'holdout' | 'idMap' | 'styles' | 'expectSha256' | 'standIn' | 'deferred'>): StructureReport {
  const holdout = path.resolve(repoRoot, args.holdout);
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!fs.existsSync(holdout) || !fs.statSync(holdout).isDirectory()) {
    return { holdout, tree: { sha256: '', files: 0 }, styles: [], missingStyles: [], problems: [`${holdout} is not a directory`], warnings, refs: [] };
  }
  const loc = locationProblems(holdout, repoRoot);
  if (loc.length > 0) {
    if (args.standIn) warnings.push(...loc.map((l) => `${l} (allowed: --development-stand-in)`));
    else problems.push(...loc);
  }
  const tree = treeSha256(holdout);
  if (args.expectSha256 !== undefined && args.expectSha256 !== tree.sha256) problems.push(`tree sha256 ${tree.sha256} does not match --expect-sha256 ${args.expectSha256}`);
  let map: RuleIdMapFile | undefined;
  if (args.idMap !== undefined) {
    try { map = loadRuleIdMap(path.resolve(repoRoot, args.idMap)); } catch (e) { problems.push(e instanceof Error ? e.message : String(e)); }
  }
  const present = REFERENCE_STYLES.filter((s) => fs.existsSync(path.join(holdout, s)));
  const extra = fs.readdirSync(holdout, { withFileTypes: true }).filter((e) => e.isDirectory() && !isReferenceStyle(e.name)).map((e) => e.name);
  if (extra.length > 0) warnings.push(`directories that are not a style (ignored): ${extra.join(', ')}`);
  const wanted = args.styles ?? present;
  const missingStyles = REFERENCE_STYLES.filter((s) => !present.includes(s));
  if (missingStyles.length > 0) warnings.push(`styles absent from the hold-out: ${missingStyles.join(', ')} (the prespec reports five styles)`);
  for (const s of wanted) if (!present.includes(s)) problems.push(`${s}: no directory ${path.join(holdout, s)}`);

  const styles: StyleStructure[] = [];
  const refs: LoadedReference[] = [];
  const work = makeTempRoot('v13-holdout-dry-');
  try {
    for (const style of wanted.filter((s) => present.includes(s))) {
      const format = (OVERLAY_REFERENCE_STYLES as readonly string[]).includes(style) ? 'overlay' : 'patch';
      const missing = REQUIRED[format].filter((f) => !fs.existsSync(path.join(holdout, style, f)));
      if (missing.length > 0) {
        problems.push(`${style}: missing ${missing.join(', ')} (${format} format)`);
        continue;
      }
      let ref: LoadedReference;
      let mappedIds: Record<string, number>;
      try {
        const loaded = applyRuleIdMap(loadReference(repoRoot, style, holdout), map);
        ref = loaded.ref;
        mappedIds = loaded.mapped;
      } catch (e) {
        problems.push(`${style}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const cross = crossCheck(ref);
      const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
      const unknown = [...new Set(ref.variants.flatMap((v) => v.manifest.expectedFindings.map((f) => f.ruleId)).filter((id) => !scope.has(id)))];
      if (unknown.length > 0) problems.push(`${style}: rule ids not in the frozen spec: ${unknown.join(', ')} (provisional ids? give --id-map)`);
      problems.push(...cross.filter((c) => !unknown.some((u) => c.includes(`${u} is not a compared rule`))).map((c) => `cross-check: ${c}`));
      for (const v of ref.variants) {
        try { materialiseVariant(ref, v, work); } catch (e) { problems.push(`${style}/${v.manifest.variant}: does not materialise: ${e instanceof Error ? e.message : String(e)}`); }
      }
      const blocking = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate && !args.deferred.includes(r.ruleId)).map((r) => r.ruleId));
      const expectedBlocking = ref.variants.reduce((a, v) => a + v.manifest.expectedFindings.filter((f) => blocking.has(f.ruleId)).length, 0);
      if (expectedBlocking < minPerfectN(RECALL_TARGET)) warnings.push(`${style}: ${String(expectedBlocking)} expected blocking findings; the M1 lower-bound check cannot pass below n = ${String(minPerfectN(RECALL_TARGET))} (prespec §5)`);
      styles.push({
        style, format,
        variants: {
          violation: ref.variants.filter((v) => v.manifest.kind === 'violation').length,
          nearMiss: ref.variants.filter((v) => v.manifest.kind === 'near-miss').length,
          clean: ref.variants.filter((v) => v.manifest.kind === 'clean').length,
        },
        expectedFindings: ref.variants.reduce((a, v) => a + v.manifest.expectedFindings.length, 0),
        expectedBlocking, mappedIds, graphFiles: ref.graph.files.length, graphEdges: ref.graph.edges.length,
      });
      refs.push(ref);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  for (const d of args.deferred) if (!refs.some((r) => r.descriptor.scopeRules.some((x) => x.ruleId === d))) warnings.push(`deferred rule ${d} is compared in no style of the hold-out`);
  if (map !== undefined) {
    for (const [style, entries] of Object.entries(map.styles)) {
      const s = styles.find((x) => x.style === style);
      if (s === undefined) continue;
      const used = new Set(Object.keys(s.mappedIds).map((k) => k.split(' -> ')[0]));
      for (const id of Object.keys(entries)) if (!used.has(id)) warnings.push(`${style}: id-map entry ${id} matched no manifest finding`);
    }
  }
  return { holdout, tree, styles, missingStyles, problems, warnings, refs };
}

export function renderStructure(r: StructureReport): string {
  const out = [`hold-out ${r.holdout}`, `tree sha256 ${r.tree.sha256} (${String(r.tree.files)} files)`];
  for (const s of r.styles) {
    const mapped = Object.entries(s.mappedIds).map(([k, n]) => `${k} x${String(n)}`).join(', ');
    out.push(`${s.style}: ${s.format} format; ${String(s.variants.violation)} violation, ${String(s.variants.nearMiss)} near-miss, ${String(s.variants.clean)} clean; ${String(s.expectedFindings)} expected findings (${String(s.expectedBlocking)} blocking = N_PER_STYLE); graph ${String(s.graphFiles)} files, ${String(s.graphEdges)} edges${mapped !== '' ? `; ids mapped: ${mapped}` : ''}`);
  }
  for (const w of r.warnings) out.push(`warning: ${w}`);
  for (const p of r.problems) out.push(`PROBLEM: ${p}`);
  out.push(r.problems.length === 0 ? 'structure: ok' : `structure: ${String(r.problems.length)} problem(s)`);
  return out.join('\n') + '\n';
}

// ── Freeze check ──────────────────────────────────────────────────────────────

export function defaultGit(repoRoot: string): GitRunner {
  return (args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Prespec §1: the run uses the code at the frozen commit. The working tree's frozen paths must equal it (no diff,
 * staged or not) and hold no untracked file. Returns the resolved sha and the problems.
 */
export function freezeCheck(git: GitRunner, commit: string): { sha: string; head: string; problems: string[] } {
  const problems: string[] = [];
  let sha = '';
  try { sha = git(['rev-parse', '--verify', `${commit}^{commit}`]).trim(); } catch { return { sha: '', head: '', problems: [`--commit ${commit} is not a commit of this repository`] }; }
  const head = git(['rev-parse', 'HEAD']).trim();
  const diff = git(['diff', '--name-only', sha, '--', ...FROZEN_PATHS]).trim();
  if (diff !== '') problems.push(`the working tree differs from ${sha.slice(0, 12)} in the frozen paths: ${diff.split('\n').slice(0, 10).join(', ')}`);
  const untracked = git(['status', '--porcelain', '--untracked-files=all', '--', ...FROZEN_PATHS]).split('\n').filter((l) => l.startsWith('??'));
  if (untracked.length > 0) problems.push(`untracked files in the frozen paths: ${untracked.slice(0, 10).map((l) => l.slice(3)).join(', ')}`);
  return { sha, head, problems };
}

// ── Run outputs ───────────────────────────────────────────────────────────────

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function rawReader(runDir: string): (style: string, variant: string) => readonly ActualFinding[] {
  return (style, variant) => {
    const file = path.join(runDir, 'raw', style, `${variant}.json`);
    if (!fs.existsSync(file)) throw new Error(`no tool output ${file}`);
    const parsed = readJson<{ findings?: unknown }>(file);
    if (!Array.isArray(parsed.findings)) throw new Error(`${file}: no findings array`);
    return parsed.findings as ActualFinding[];
  };
}

/** Variants whose raw rows differ between two runs (prespec §2.3: a difference is a defect; the first run stands). */
export function determinismDiff(runA: string, runB: string, refs: readonly LoadedReference[]): string[] {
  const a = rawReader(runA);
  const b = rawReader(runB);
  const canon = (rows: readonly ActualFinding[]): string => JSON.stringify(rows.map((r) => `${r.ruleId}|${r.file}|${r.target ?? ''}`).sort());
  const diff: string[] = [];
  for (const ref of refs) for (const v of ref.variants) {
    const id = `${ref.style}/${v.manifest.variant}`;
    try { if (canon(a(ref.style, v.manifest.variant)) !== canon(b(ref.style, v.manifest.variant))) diff.push(id); } catch (e) { diff.push(`${id} (${e instanceof Error ? e.message : String(e)})`); }
  }
  return diff;
}

/** The correctness checker over every reported blocking finding (M3), on freshly materialised variants. */
export async function runCorrectness(refs: readonly LoadedReference[], runDir: string, outDir: string, io: HoldoutIo): Promise<CorrectnessRow[]> {
  const work = makeTempRoot('v13-holdout-correct-');
  try {
    const jobs: LabellingJob[] = [];
    for (const ref of refs) for (const v of ref.variants) {
      const report = path.join(runDir, 'evidence', ref.style, `${v.manifest.variant}.json`);
      if (!fs.existsSync(report)) continue;
      const m = materialiseVariant(ref, v, work);
      jobs.push({ projectId: `${ref.style}/${v.manifest.variant}`, projectRoot: m.projectDir, spec: ref.specPath, report, style: ref.style });
    }
    if (jobs.length === 0) {
      io.err('correctness: no evidence files; M3 not scored\n');
      return [];
    }
    const jobsFile = path.join(work, 'jobs.json');
    fs.writeFileSync(jobsFile, JSON.stringify({ schemaVersion: 1, kind: 'reference', jobs }, null, 2));
    const code = await checkMain(['--jobs', jobsFile, '--tiers', 'blocking', '--out', outDir], { env: io.env, out: () => undefined, err: io.err });
    if (code !== 0) throw new Error(`check-correct exited ${String(code)}`);
    return readJson<{ results: CorrectnessRow[] }>(path.join(outDir, 'correctness.json')).results;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function defaultSpawn(repoRoot: string): NodeSpawner {
  return (args, env) => {
    const r = spawnSync(process.execPath, [...args], { cwd: repoRoot, env, stdio: 'inherit' });
    return r.status ?? 2;
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function holdoutMain(argv: readonly string[], repoRoot: string, io: HoldoutIo, deps: HoldoutDeps = {}): Promise<number> {
  const args = parseHoldoutArgs(argv);
  if (typeof args === 'string') {
    io.err(`${args}\n`);
    return 2;
  }
  const structure = checkStructure(repoRoot, args);
  io.out(renderStructure(structure));
  if (structure.problems.length > 0) return 1;
  if (args.mode === 'dry-run') return 0;

  const now = deps.now ?? (() => new Date());
  const started = now().toISOString();
  const git = deps.git ?? defaultGit(repoRoot);
  const freeze = freezeCheck(git, args.commit ?? '');
  for (const p of freeze.problems) io.err(`freeze: ${p}\n`);
  if (freeze.problems.length > 0) return 1;
  io.out(`freeze: working tree equals ${freeze.sha} in ${FROZEN_PATHS.join(', ')} (HEAD ${freeze.head})\n`);

  const outDir = path.resolve(repoRoot, args.out ?? '');
  const runDir = args.mode === 'from-raw' ? path.resolve(repoRoot, args.fromRaw ?? '') : outDir;
  const styleArgs = ['--style', structure.refs.map((r) => r.style).join(',')];
  const spawnNode = deps.spawnNode ?? defaultSpawn(repoRoot);
  if (args.mode === 'live') {
    if ((io.env.NEO4J_URI ?? '') === '' || (io.env.NEO4J_PASSWORD ?? '') === '') {
      io.err('live run needs Neo4j: set NEO4J_URI and NEO4J_PASSWORD (or use --dry-run or --from-raw <run dir>)\n');
      return 2;
    }
    if (fs.existsSync(path.join(outDir, 'raw'))) {
      io.err(`${outDir}/raw exists: the hold-out is run once (prespec §2.3); give a new --out, or score it with --from-raw\n`);
      return 1;
    }
    const idMapArgs = args.idMap !== undefined ? ['--id-map', path.resolve(repoRoot, args.idMap)] : [];
    const live = spawnNode(['--import', 'tsx', 'scripts/v1.3/ue-baseline-live.ts', '--root', structure.holdout, '--out', outDir, ...styleArgs, ...idMapArgs], io.env);
    if (live !== 0) {
      io.err(`ue-baseline-live.ts exited ${String(live)}\n`);
      return 1;
    }
  }
  if (!fs.existsSync(path.join(runDir, 'graph', 'tool-graphs.json'))) {
    const g = spawnNode(['--import', 'tsx', 'scripts/v1.3/ue-graph.ts', '--root', structure.holdout, '--out', outDir, ...styleArgs], io.env);
    if (g !== 0) {
      io.err(`ue-graph.ts exited ${String(g)}\n`);
      return 1;
    }
  }
  const graphFile = [path.join(runDir, 'graph', 'tool-graphs.json'), path.join(outDir, 'graph', 'tool-graphs.json')].find((f) => fs.existsSync(f));
  const graphs = graphFile === undefined ? undefined : readJson<Record<string, Record<string, ToolGraph>>>(graphFile);

  fs.mkdirSync(outDir, { recursive: true });
  const correctness = args.correctness ? await runCorrectness(structure.refs, runDir, path.join(outDir, 'correctness'), io) : undefined;
  const scores = scoreHoldout({
    refs: structure.refs,
    actualOf: rawReader(runDir),
    ...(graphs !== undefined && { toolGraphOf: (s: string, v: string) => graphs[s]?.[v] }),
    ...(correctness !== undefined && correctness.length > 0 && { correctness }),
    deferredRules: args.deferred,
    ...(args.graphAdjudication !== undefined && { graphAdjudication: readJson<GraphAdjudication>(path.resolve(repoRoot, args.graphAdjudication)) }),
  });
  const determinism = args.determinism === undefined ? undefined : determinismDiff(runDir, path.resolve(repoRoot, args.determinism), structure.refs);

  const shown = (p: string): string => {
    const rel = path.relative(repoRoot, p);
    return rel === '' ? '.' : rel.startsWith('..') ? p : rel;
  };
  const header = args.standIn
    ? '# DEVELOPMENT-SET STAND-IN: holdout-run.ts on the development reference set (not a hold-out result, not a validity figure)'
    : '# v1.3 hold-out run: scores (Docs/v1.3/holdout-prespec.md)';
  const md = renderHoldoutMarkdown(scores, `${header}\n\nTool commit ${freeze.sha}. Hold-out tree sha256 ${structure.tree.sha256}. Run directory ${shown(runDir)}.${determinism !== undefined ? ` Determinism repeat: ${determinism.length === 0 ? 'identical raw rows' : `DIFFERS in ${determinism.join(', ')} (a defect; the first run stands)`}.` : ''}`);
  fs.writeFileSync(path.join(outDir, 'holdout-scores.md'), md);
  fs.writeFileSync(path.join(outDir, 'holdout-scores.json'), JSON.stringify({ standIn: args.standIn, commit: freeze.sha, treeSha256: structure.tree.sha256, ...(determinism !== undefined && { determinism }), scores: scoresJson(scores) }, null, 1) + '\n');
  const uri = io.env.NEO4J_URI ?? '';
  fs.writeFileSync(path.join(outDir, 'holdout-run-provenance.json'), JSON.stringify({
    standIn: args.standIn,
    note: args.standIn ? 'Development-set stand-in for testing the runner; never a validity figure.' : 'One-time hold-out run (prespec §2).',
    mode: args.mode, commit: freeze.sha, head: freeze.head, frozenPaths: FROZEN_PATHS,
    holdout: structure.holdout, holdoutTree: structure.tree, runDir,
    idMap: args.idMap ?? null, idsMapped: Object.fromEntries(structure.styles.map((s) => [s.style, s.mappedIds])),
    deferredRules: args.deferred, graphAdjudication: args.graphAdjudication ?? null, correctness: correctness === undefined ? 'skipped' : `${String(correctness.length)} blocking findings checked`,
    neo4j: args.mode === 'live' ? uri.replace(/\/\/[^@/]*@/, '//') : null,
    node: process.version, started, ended: now().toISOString(),
  }, null, 2) + '\n');
  io.out(`${claimLines(scores).join('\n')}\n`);
  io.out(`wrote ${shown(outDir)}/holdout-scores.{md,json}\n`);
  return determinism !== undefined && determinism.length > 0 ? 1 : 0;
}
