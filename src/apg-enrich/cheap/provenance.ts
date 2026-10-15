/**
 * Batch 2, proxy 17, AGENT PROVENANCE: which agent step created or last changed each file, node and edge of a project
 * that an agent built step by step, which findings each step introduced, where an agent re-implemented existing code
 * instead of reusing it, and how local each step stayed.
 *
 * Input, a SNAPSHOT HISTORY: an ordered list of snapshots (commits) with their step metadata. Two readers:
 * - `readLoopRun(runDir)`: a run directory of the firewall-in-the-loop harness (`scripts/lib/loop/`): `run.json`,
 *   `steps/step-NN.json` and the snapshot store `snapshots.git` outside the work tree. One snapshot per TURN (a gate
 *   step with a repair has two), with the run's arm, adapter and model, the task step and the turn's prompt sha256, and
 *   the blocking findings the harness recorded on it.
 * - `readGitHistory(repo)`: a plain git history with one commit per step (first parent, oldest first). Metadata comes
 *   from commit trailers when present (`Step:`, `Step-Id:`, `Turn:`, `Arm:`, `Model:`, `Adapter:`, `Task:`,
 *   `Prompt-Sha256:`), else the commit's position and subject.
 *
 * `analyseProvenance` checks every snapshot out (git archive, read only), extracts its APG, runs the context proxies,
 * and compares consecutive snapshots. Node and edge ids are path based, so they are stable across snapshots.
 *
 * Facts:
 * - `Step` virtual nodes (`step:<n>:<turnId>`); per File node of the last snapshot `createdAtStep`, `lastModifiedAtStep`
 *   and `modifiedAtSteps` (provenance records: turn, task step, arm, adapter, model, prompt sha256) and CREATED_AT_STEP /
 *   MODIFIED_AT_STEP edges from the File to the Step node; per APG edge of the last snapshot the step that introduced
 *   it (`edgeFacts`): the first snapshot of the edge's last uninterrupted run of presence.
 * - EROSION DELTA per snapshot: findings present at k and not at k − 1 (new) and the reverse (resolved). Blocking
 *   findings: the harness's recorded findings (loop store) and, with a layer model, the in-memory dependency-direction
 *   rule (`v13DependencyDirection`); advisory findings: the flags of the context proxies. Each new finding is
 *   ATTRIBUTED to the step that introduced the offending edge (a finding with a target file: the IMPORTS edge between
 *   the two files), else to the step that last changed its unit (Method / Class node text), else its file.
 * - REIMPLEMENTS (new unit → existing unit): a Method, Function or Class created at k that (a) is a clone (the batch-1
 *   clone proxy's SAME_LOGIC_AS on snapshot k) of a unit that existed at k − 1, or (b) for a class, shares the concept
 *   and the member vocabulary of a class that existed at k − 1 (`vocabularyMatch`). Not a candidate when the new unit's
 *   file imports the old one's (reuse), one extends or implements the other, or both implement / extend a common
 *   type (alternative adapters of one port).
 * - AGENT LOCALITY per snapshot: the components the turn touched (files added, modified, deleted) against the
 *   feature's scope (the components of the files it added; with none added, the component it touched most):
 *   locality = touched files inside the scope / touched files.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { extractAPG } from '../../apg-extractor/index.js';
import type { ExtractorOptions } from '../../apg-extractor/index.js';
import type { APGResult } from '../../shared/types/apg.js';
import type { LayerModel } from '../../shared/types/spec.js';
import { memGraph } from '../../fitness-compiler/apg2-in-memory.js';
import { v13DependencyDirection } from '../../fitness-compiler/v13-in-memory-baselines.js';
import { generateEdgeId } from '../../apg-extractor/id-generator.js';
import { buildContext, classesOf, componentOf } from './context.js';
import type { CheapContext } from './context.js';
import { camelTokens, topLevelFunctions } from './behaviour.js';
import { git, gitBytes } from './git.js';
import { DEFAULT_CHEAP_OPTIONS } from './types.js';
import type { CheapEdge, CheapFlag, CheapNodeFact, CheapVirtualNode, ContextProxyId } from './types.js';

export interface RecordedFinding {
  readonly ruleId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly line?: number;
  readonly message: string;
}

export interface ProvenanceStep {
  /** Snapshot order, 0-based. */
  readonly index: number;
  readonly commit: string;
  /** `step-02`, `step-02-repair`, or `commit-<n>` for a plain git history without trailers. */
  readonly turnId: string;
  readonly kind: 'step' | 'repair' | 'commit';
  /** Task step, 0-based. */
  readonly stepIndex: number;
  readonly stepId: string;
  readonly arm: string | null;
  readonly adapterId: string | null;
  readonly modelId: string | null;
  readonly taskId: string | null;
  readonly promptSha256: string | null;
  /** Blocking findings the harness recorded on this snapshot (loop store only; null when none was recorded). */
  readonly recordedFindings: readonly RecordedFinding[] | null;
}

export interface SnapshotHistory {
  readonly source: 'loop-store' | 'git';
  readonly runId: string | null;
  /** Git arguments that select the repository (`--git-dir=…` or `-C …`). */
  readonly gitArgs: readonly string[];
  /** The project's directory inside the snapshot trees ('' = the whole tree). */
  readonly pathPrefix: string;
  /** The commit before the first snapshot (the loop's skeleton commit), or null (empty tree). */
  readonly baseCommit: string | null;
  readonly steps: readonly ProvenanceStep[];
}

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** Reads a loop-harness run directory (`<outRoot>/runs/<adapter>/<model>/<task>/<arm>/run-<r>`). */
export function readLoopRun(runDir: string): SnapshotHistory {
  const run = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8')) as {
    runId: string; baseCommit: string; spec: { adapterId: string; modelId: string; taskId: string; arm: string };
  };
  const stepsDir = path.join(runDir, 'steps');
  const files = fs.existsSync(stepsDir) ? fs.readdirSync(stepsDir).filter((f) => /^step-\d+\.json$/.test(f)).sort() : [];
  const steps: ProvenanceStep[] = [];
  for (const f of files) {
    const rec = JSON.parse(fs.readFileSync(path.join(stepsDir, f), 'utf8')) as {
      stepIndex: number; stepId: string;
      turns: { turnId: string; kind: 'step' | 'repair'; promptSha256: string; snapshot: { commit: string; evaluation: { blockingFindings: RecordedFinding[] } | null } }[];
    };
    for (const t of rec.turns) {
      steps.push({
        index: steps.length, commit: t.snapshot.commit, turnId: t.turnId, kind: t.kind, stepIndex: rec.stepIndex, stepId: rec.stepId,
        arm: run.spec.arm, adapterId: run.spec.adapterId, modelId: run.spec.modelId, taskId: run.spec.taskId, promptSha256: t.promptSha256,
        recordedFindings: t.snapshot.evaluation === null ? null : t.snapshot.evaluation.blockingFindings,
      });
    }
  }
  return { source: 'loop-store', runId: run.runId, gitArgs: [`--git-dir=${path.join(runDir, 'snapshots.git')}`], pathPrefix: '', baseCommit: run.baseCommit, steps };
}

/**
 * Reads a plain git history, one commit per step: the first-parent commits after `from` (exclusive; default: from the
 * root commit, inclusive) up to `to` (default HEAD), restricted to `pathPrefix` when given.
 */
export function readGitHistory(repoDir: string, opts: { readonly from?: string; readonly to?: string; readonly pathPrefix?: string } = {}): SnapshotHistory {
  const gitArgs = ['-C', repoDir];
  const range = opts.from !== undefined ? `${opts.from}..${opts.to ?? 'HEAD'}` : opts.to ?? 'HEAD';
  const out = git(gitArgs, ['log', '--reverse', '--first-parent', '--format=%H%x1f%s%x1f%(trailers:only=true,unfold=true)%x1e', range, ...(opts.pathPrefix !== undefined && opts.pathPrefix !== '' ? ['--', opts.pathPrefix] : [])]);
  if (out === null) throw new Error(`not a git history: ${repoDir}`);
  const steps: ProvenanceStep[] = [];
  for (const rec of out.split('\x1e')) {
    const [sha, subject, trailers] = rec.replace(/^\n/, '').split('\x1f');
    if (sha === undefined || sha.trim() === '') continue;
    const tr = new Map<string, string>();
    for (const line of (trailers ?? '').split('\n')) {
      const m = /^([A-Za-z0-9-]+):\s*(.*)$/.exec(line.trim());
      if (m?.[1] !== undefined && m[2] !== undefined) tr.set(m[1].toLowerCase(), m[2].trim());
    }
    const n = steps.length;
    const turn = tr.get('turn');
    const stepNum = tr.get('step');
    const stepIndex = stepNum !== undefined && /^\d+$/.test(stepNum) ? Number(stepNum) - 1 : n;
    steps.push({
      index: n, commit: sha.trim(), turnId: turn ?? `commit-${String(n + 1).padStart(2, '0')}`,
      kind: turn?.endsWith('-repair') === true ? 'repair' : turn !== undefined ? 'step' : 'commit',
      stepIndex, stepId: tr.get('step-id') ?? (subject ?? '').trim().slice(0, 60),
      arm: tr.get('arm') ?? null, adapterId: tr.get('adapter') ?? null, modelId: tr.get('model') ?? null, taskId: tr.get('task') ?? null,
      promptSha256: tr.get('prompt-sha256') ?? null, recordedFindings: null,
    });
  }
  const first = steps[0];
  const parent = first === undefined ? null : git(gitArgs, ['rev-parse', '--verify', '--quiet', `${first.commit}^`]);
  return { source: 'git', runId: null, gitArgs, pathPrefix: opts.pathPrefix ?? '', baseCommit: parent === null ? null : parent.trim(), steps };
}

export interface ProvenanceOptions {
  readonly layerModel?: LayerModel;
  readonly extractorOptions?: ExtractorOptions;
  /** Context proxies whose flags are the advisory findings (`DEFAULT_FINDING_PROXIES`). `clones` always runs. */
  readonly findingProxies?: readonly ContextProxyId[];
  /** Minimum concept-term Jaccard of two class names for a vocabulary REIMPLEMENTS candidate (default 0.5). */
  readonly conceptThreshold?: number;
  /** Minimum member-term Jaccard (default 0.3) and shared member terms (default 2) of the two classes. */
  readonly memberThreshold?: number;
  readonly minSharedMembers?: number;
  /** Where snapshots are checked out (default: a fresh temp directory, removed afterwards). */
  readonly workDir?: string;
}

export const DEFAULT_FINDING_PROXIES: readonly ContextProxyId[] = Object.freeze([
  'clones', 'shared-literals', 'name-behaviour', 'cohesion', 'logic-density', 'repo-bypass', 'framework-in-core',
  'error-flow', 'reachability', 'sdk-spread', 'config-surface',
]);

export interface ProvenanceRecord {
  readonly index: number;
  readonly turnId: string;
  readonly stepIndex: number;
  readonly stepId: string;
  readonly arm: string | null;
  readonly adapterId: string | null;
  readonly modelId: string | null;
  readonly taskId: string | null;
  readonly promptSha256: string | null;
}

export interface ProvFinding {
  readonly key: string;
  readonly tier: 'blocking' | 'advisory';
  readonly rule: string;
  readonly file: string;
  readonly target?: string;
  readonly className?: string;
  readonly methodName?: string;
  readonly message: string;
}

export interface AttributedFinding extends ProvFinding {
  /** The snapshot the finding is attributed to, and how (`edge`, `unit`, `file`). */
  readonly attributedTo: number;
  readonly attributedTurn: string;
  readonly via: 'edge' | 'unit' | 'file';
}

export interface ErosionDelta {
  readonly index: number;
  readonly turnId: string;
  readonly stepIndex: number;
  readonly totalBlocking: number;
  readonly totalAdvisory: number;
  readonly newBlocking: number;
  readonly newAdvisory: number;
  readonly resolvedBlocking: number;
  readonly resolvedAdvisory: number;
  readonly newFindings: readonly AttributedFinding[];
}

export interface LocalityRecord {
  readonly index: number;
  readonly turnId: string;
  readonly filesTouched: number;
  readonly componentsTouched: readonly string[];
  readonly layersTouched: readonly string[];
  readonly scope: readonly string[];
  /** Touched files inside the scope / touched files; null when the turn touched no file. */
  readonly locality: number | null;
}

export interface ProvenanceResult {
  readonly history: Omit<SnapshotHistory, 'gitArgs'>;
  /** The APG of the last snapshot (the graph the facts are about); null for an empty history. */
  readonly apg: APGResult | null;
  readonly virtualNodes: readonly CheapVirtualNode[];
  readonly edges: readonly CheapEdge[];
  readonly nodeFacts: readonly CheapNodeFact[];
  /** Per APG edge of the last snapshot: the step that introduced it. */
  readonly edgeFacts: readonly { readonly edgeId: string; readonly type: string; readonly createdAt: ProvenanceRecord }[];
  readonly flags: readonly CheapFlag[];
  readonly erosion: readonly ErosionDelta[];
  readonly locality: readonly LocalityRecord[];
  readonly summary: Record<string, unknown>;
}

interface Snapshot {
  readonly index: number;
  readonly apg: APGResult;
  readonly ctx: CheapContext;
  readonly files: ReadonlySet<string>;
  readonly edgeIds: ReadonlySet<string>;
  readonly nodeHash: ReadonlyMap<string, string>;
  readonly findings: ReadonlyMap<string, ProvFinding>;
  readonly sameLogic: readonly CheapEdge[];
  readonly diff: readonly { status: 'A' | 'M' | 'D'; file: string }[];
}

function materialise(history: SnapshotHistory, commit: string, dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const treeish = history.pathPrefix === '' ? commit : `${commit}:${history.pathPrefix}`;
  const tar = gitBytes(history.gitArgs, ['archive', '--format=tar', treeish]);
  if (tar === null) throw new Error(`git archive ${treeish} failed`);
  const r = spawnSync('tar', ['-x', '-C', dir], { input: tar });
  if (r.status !== 0) throw new Error(`tar -x failed for ${commit}`);
  if (!fs.existsSync(path.join(dir, 'tsconfig.json'))) {
    // A loop work tree has no tsconfig (the skeleton supplies the type-check of record); extraction needs one.
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', strict: true, experimentalDecorators: true, skipLibCheck: true, types: [] },
      include: ['**/*.ts'], exclude: ['node_modules'],
    }));
  }
}

function diffOf(history: SnapshotHistory, from: string | null, to: string): { status: 'A' | 'M' | 'D'; file: string }[] {
  const out = git(history.gitArgs, ['diff', '--name-status', '--no-renames', from ?? EMPTY_TREE, to, ...(history.pathPrefix === '' ? [] : ['--', history.pathPrefix])]);
  if (out === null) throw new Error(`git diff ${from ?? 'empty'} ${to} failed`);
  const res: { status: 'A' | 'M' | 'D'; file: string }[] = [];
  for (const line of out.split('\n')) {
    const m = /^([AMD])\t(.+)$/.exec(line);
    if (m?.[1] === undefined || m[2] === undefined) continue;
    const f = history.pathPrefix === '' ? m[2] : m[2].slice(history.pathPrefix.length + 1);
    res.push({ status: m[1] as 'A' | 'M' | 'D', file: f });
  }
  return res;
}

const hash = (s: string): string => createHash('sha1').update(s).digest('hex');

function unitHashes(ctx: CheapContext): Map<string, string> {
  const out = new Map<string, string>();
  for (const { file, sf } of ctx.sources) {
    for (const cls of classesOf(sf)) {
      const cn = cls.getName() ?? '';
      const id = ctx.nodeId('Class', file, cn);
      if (id !== undefined) out.set(id, hash(cls.getText()));
      for (const m of cls.getMethods()) {
        const mid = ctx.nodeId('Method', file, `${cn}.${m.getName()}`);
        if (mid !== undefined) out.set(mid, hash((out.get(mid) ?? '') + m.getText()));
      }
    }
    for (const f of topLevelFunctions(sf)) {
      const id = ctx.nodeId('Function', file, f.name);
      if (id !== undefined) out.set(id, hash(f.node.getText()));
    }
  }
  return out;
}

async function snapshotOf(history: SnapshotHistory, index: number, commit: string, prev: string | null, dir: string, opts: ProvenanceOptions): Promise<Snapshot> {
  materialise(history, commit, dir);
  const root = fs.realpathSync(dir);
  const tsconfig = path.join(root, 'tsconfig.json');
  const res = await extractAPG(root, opts.extractorOptions ?? {}, tsconfig);
  if (!res.success) throw new Error(`extraction of ${commit} failed: ${res.errors.map((e) => e.message).join('; ')}`);
  const apg = res.data;
  const { openProject, enrichCheap } = await import('./index.js');
  const project = openProject(tsconfig);
  const input = { apg, project, projectRoot: root, ...(opts.layerModel !== undefined ? { layerModel: opts.layerModel } : {}) };
  const proxies = [...new Set<ContextProxyId>(['clones', ...(opts.findingProxies ?? DEFAULT_FINDING_PROXIES)])];
  const enr = enrichCheap(input, { proxies });
  const ctx = buildContext(input, { ...DEFAULT_CHEAP_OPTIONS, proxies });
  const findings = new Map<string, ProvFinding>();
  const wantFlags = new Set(opts.findingProxies ?? DEFAULT_FINDING_PROXIES);
  for (const f of enr.flags) {
    if (!wantFlags.has(f.proxy as ContextProxyId)) continue;
    const key = `advisory|${f.proxy}:${f.kind}|${f.evidence.file}|${f.className ?? ''}|${f.methodName ?? ''}|${f.related?.file ?? ''}`;
    findings.set(key, { key, tier: 'advisory', rule: `${f.proxy}:${f.kind}`, file: f.evidence.file, ...(f.className !== undefined ? { className: f.className } : {}), ...(f.methodName !== undefined ? { methodName: f.methodName } : {}), message: f.message });
  }
  if (opts.layerModel !== undefined && opts.layerModel.layers.length > 1) {
    const g = memGraph(apg, opts.layerModel);
    for (const r of v13DependencyDirection(g, opts.layerModel.layers.map((l) => l.name))) {
      const source = String(r.source);
      const target = String(r.target);
      const key = `blocking|dependency-direction|${source}|${target}`;
      findings.set(key, { key, tier: 'blocking', rule: 'dependency-direction', file: source, target, message: `${source} imports ${target} against the layer order` });
    }
  }
  const files = new Set(apg.nodes.filter((n) => n.type === 'File').map((n) => n.filePath));
  const step = history.steps[index];
  for (const rf of step?.recordedFindings ?? []) {
    const target = rf.target === undefined ? undefined : resolveSpecifier(rf.filePath, rf.target, files);
    const key = `blocking|${rf.ruleId}|${rf.filePath}|${target ?? rf.target ?? ''}`;
    findings.set(key, { key, tier: 'blocking', rule: rf.ruleId, file: rf.filePath, ...(target !== undefined ? { target } : {}), message: rf.message });
  }
  return {
    index, apg, ctx, files,
    edgeIds: new Set(apg.edges.map((e) => e.id)),
    nodeHash: unitHashes(ctx),
    findings,
    sameLogic: enr.edges.filter((e) => e.type === 'SAME_LOGIC_AS'),
    diff: diffOf(history, prev, commit),
  };
}

/** A relative import specifier of `from` resolved against the snapshot's files (`.ts`, `/index.ts`). */
function resolveSpecifier(from: string, spec: string, files: ReadonlySet<string>): string | undefined {
  if (!spec.startsWith('.')) return files.has(spec) ? spec : undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)).replace(/\.(js|ts)$/, '');
  for (const c of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) if (files.has(c)) return c;
  return undefined;
}

const ROLE_WORDS = new Set([
  'service', 'services', 'repository', 'repo', 'store', 'dao', 'controller', 'handler', 'manager', 'helper', 'util',
  'utils', 'adapter', 'client', 'gateway', 'provider', 'impl', 'factory', 'model', 'entity', 'dto', 'memory',
  'inmemory', 'default', 'base', 'abstract', 'simple', 'new', 'my', 'the', 'and', 'for', 'with',
]);
const LANG_WORDS = new Set(['get', 'set', 'the', 'and', 'for', 'with', 'from', 'this', 'new', 'async', 'await', 'return', 'const', 'void', 'null', 'undefined', 'true', 'false', 'string', 'number', 'boolean', 'promise', 'private', 'public', 'readonly', 'constructor']);

/** Lower-case camel-case terms of an identifier, at least 3 letters, plural `s` folded. */
export function identTerms(name: string): string[] {
  return camelTokens(name).map((t) => t.toLowerCase()).filter((t) => t.length >= 3 && /^[a-z]+$/.test(t) && !LANG_WORDS.has(t)).map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface ClassVocabulary {
  readonly concept: ReadonlySet<string>;
  readonly members: ReadonlySet<string>;
}

/** The concept (class-name terms minus role words) and member vocabulary (method and property names) of a class. */
export function classVocabulary(cls: import('ts-morph').ClassDeclaration): ClassVocabulary {
  const concept = new Set(identTerms(cls.getName() ?? '').filter((t) => !ROLE_WORDS.has(t)));
  const members = new Set([...cls.getMethods(), ...cls.getProperties(), ...cls.getGetAccessors()].flatMap((m) => identTerms(m.getName())));
  return { concept, members };
}

/** Vocabulary match of two classes (see the module comment); null when they do not match. */
export function vocabularyMatch(a: ClassVocabulary, b: ClassVocabulary, opts: { concept: number; member: number; minShared: number }): number | null {
  if (a.concept.size === 0 || b.concept.size === 0) return null;
  const cj = jaccard(a.concept, b.concept);
  if (cj < opts.concept) return null;
  let shared = 0;
  for (const x of a.members) if (b.members.has(x)) shared++;
  const mj = jaccard(a.members, b.members);
  if (shared < opts.minShared || mj < opts.member) return null;
  return (cj + mj) / 2;
}

export async function analyseProvenance(history: SnapshotHistory, opts: ProvenanceOptions = {}): Promise<ProvenanceResult> {
  const work = opts.workDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'cheap-provenance-'));
  const steps = history.steps;
  const rec = (i: number): ProvenanceRecord => {
    const s = steps[i];
    if (s === undefined) return { index: -1, turnId: 'base', stepIndex: -1, stepId: 'base', arm: null, adapterId: null, modelId: null, taskId: null, promptSha256: null };
    return { index: s.index, turnId: s.turnId, stepIndex: s.stepIndex, stepId: s.stepId, arm: s.arm, adapterId: s.adapterId, modelId: s.modelId, taskId: s.taskId, promptSha256: s.promptSha256 };
  };
  const snaps: Snapshot[] = [];
  try {
    let prev = history.baseCommit;
    for (const s of steps) {
      snaps.push(await snapshotOf(history, s.index, s.commit, prev, path.join(work, `snap-${String(s.index)}`), opts));
      prev = s.commit;
    }
  } finally {
    if (opts.workDir === undefined) fs.rmSync(work, { recursive: true, force: true });
  }
  const last = snaps[snaps.length - 1];
  const virtualNodes: CheapVirtualNode[] = steps.map((s) => ({ id: stepNodeId(s), kind: 'Step', name: s.turnId, properties: { ...rec(s.index), kind: s.kind, commit: s.commit } }));
  const edges: CheapEdge[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const flags: CheapFlag[] = [];
  const stepIdOf = (i: number): string => {
    const s = steps[i];
    return s === undefined ? 'step:base' : stepNodeId(s);
  };

  // ── Files: created / modified per snapshot ──
  const created = new Map<string, number>();
  const modified = new Map<string, number[]>();
  for (const sn of snaps) {
    for (const d of sn.diff) {
      if (d.status === 'D') {
        created.delete(d.file);
        modified.delete(d.file);
      } else if (d.status === 'A') {
        created.set(d.file, sn.index);
        modified.set(d.file, [sn.index]);
      } else {
        modified.set(d.file, [...(modified.get(d.file) ?? []), sn.index]);
        if (!created.has(d.file)) created.set(d.file, -1);
      }
    }
  }
  const lastModifiedBy = (file: string, upTo: number): number => {
    const ms = (modified.get(file) ?? []).filter((i) => i <= upTo);
    return ms.length === 0 ? created.get(file) ?? -1 : Math.max(...ms);
  };
  if (last !== undefined) {
    for (const f of [...last.files].sort()) {
      const id = last.ctx.info(f).fileNodeId;
      if (id === undefined) continue;
      const c = created.get(f) ?? -1;
      const mods = modified.get(f) ?? [];
      const lm = mods.length === 0 ? c : Math.max(...mods);
      nodeFacts.push({ proxy: 'agent-provenance', nodeId: id, key: 'createdAtStep', value: rec(c) });
      nodeFacts.push({ proxy: 'agent-provenance', nodeId: id, key: 'lastModifiedAtStep', value: rec(lm) });
      nodeFacts.push({ proxy: 'agent-provenance', nodeId: id, key: 'modifiedAtSteps', value: mods.map((i) => rec(i).turnId) });
      edges.push({ type: 'CREATED_AT_STEP', proxy: 'agent-provenance', sourceId: id, targetId: stepIdOf(c), score: 1, evidence: [{ file: f, startLine: 1, endLine: 1 }], properties: { turnId: rec(c).turnId } });
      for (const i of mods) if (i !== c) edges.push({ type: 'MODIFIED_AT_STEP', proxy: 'agent-provenance', sourceId: id, targetId: stepIdOf(i), score: 1, evidence: [{ file: f, startLine: 1, endLine: 1 }], properties: { turnId: rec(i).turnId } });
    }
  }

  // ── Edges and units: introduced at (first snapshot of the last uninterrupted presence up to k) ──
  const introducedAt = (has: (sn: Snapshot) => boolean, k: number): number => {
    let j = k;
    for (let prev = snaps[j - 1]; j > 0 && prev !== undefined && has(prev); prev = snaps[j - 1]) j--;
    return j;
  };
  const edgeFacts: { edgeId: string; type: string; createdAt: ProvenanceRecord }[] = [];
  if (last !== undefined) {
    for (const e of last.apg.edges) edgeFacts.push({ edgeId: e.id, type: e.type, createdAt: rec(introducedAt((sn) => sn.edgeIds.has(e.id), last.index)) });
  }
  const unitChangedAt = (nodeId: string, k: number): number | null => {
    const h = snaps[k]?.nodeHash.get(nodeId);
    if (h === undefined) return null;
    let j = k;
    while (j > 0 && snaps[j - 1]?.nodeHash.get(nodeId) === h) j--;
    return j;
  };

  // ── Erosion delta and attribution ──
  const erosion: ErosionDelta[] = [];
  const attributedCount = new Map<number, { blocking: number; advisory: number }>();
  for (const sn of snaps) {
    const before = snaps[sn.index - 1]?.findings ?? new Map<string, ProvFinding>();
    const fresh = [...sn.findings.values()].filter((f) => !before.has(f.key)).sort((a, b) => (a.key < b.key ? -1 : 1));
    const resolved = [...before.values()].filter((f) => !sn.findings.has(f.key));
    const attributed: AttributedFinding[] = fresh.map((f) => {
      let at: number | null = null;
      let via: AttributedFinding['via'] = 'file';
      if (f.target !== undefined) {
        const s = sn.ctx.info(f.file).fileNodeId;
        const t = sn.ctx.info(f.target).fileNodeId;
        if (s !== undefined && t !== undefined) {
          const id = [generateEdgeId('IMPORTS', s, t), generateEdgeId('RE_EXPORTS', s, t)].find((x) => sn.edgeIds.has(x));
          if (id !== undefined) {
            at = introducedAt((x) => x.edgeIds.has(id), sn.index);
            via = 'edge';
          }
        }
      }
      if (at === null && f.className !== undefined) {
        const nid = (f.methodName !== undefined ? sn.ctx.nodeId('Method', f.file, `${f.className}.${f.methodName}`) : undefined) ?? sn.ctx.nodeId('Class', f.file, f.className);
        const c = nid === undefined ? null : unitChangedAt(nid, sn.index);
        if (c !== null) {
          at = c;
          via = 'unit';
        }
      }
      at ??= Math.max(0, lastModifiedBy(f.file, sn.index));
      const a = attributedCount.get(at) ?? { blocking: 0, advisory: 0 };
      a[f.tier]++;
      attributedCount.set(at, a);
      return { ...f, attributedTo: at, attributedTurn: rec(at).turnId, via };
    });
    const s = steps[sn.index];
    erosion.push({
      index: sn.index, turnId: s?.turnId ?? '', stepIndex: s?.stepIndex ?? sn.index,
      totalBlocking: [...sn.findings.values()].filter((f) => f.tier === 'blocking').length,
      totalAdvisory: [...sn.findings.values()].filter((f) => f.tier === 'advisory').length,
      newBlocking: fresh.filter((f) => f.tier === 'blocking').length,
      newAdvisory: fresh.filter((f) => f.tier === 'advisory').length,
      resolvedBlocking: resolved.filter((f) => f.tier === 'blocking').length,
      resolvedAdvisory: resolved.filter((f) => f.tier === 'advisory').length,
      newFindings: attributed,
    });
  }

  // ── REIMPLEMENTS candidates ──
  const vopts = { concept: opts.conceptThreshold ?? 0.5, member: opts.memberThreshold ?? 0.3, minShared: opts.minSharedMembers ?? 2 };
  let reimplClone = 0;
  let reimplVocab = 0;
  for (const sn of snaps) {
    const prevSnap = snaps[sn.index - 1];
    if (prevSnap === undefined) continue;
    const existedBefore = (id: string): boolean => prevSnap.nodeHash.has(id);
    const nodeById = new Map(sn.apg.nodes.map((n) => [n.id, n]));
    const fileImports = new Set(sn.apg.edges.filter((e) => e.type === 'IMPORTS').map((e) => `${e.sourceId}>${e.targetId}`));
    const supertypes = new Map<string, Set<string>>();
    for (const e of sn.apg.edges) if (e.type === 'EXTENDS' || e.type === 'IMPLEMENTS') {
      const s = supertypes.get(e.sourceId) ?? new Set<string>();
      s.add(e.targetId);
      supertypes.set(e.sourceId, s);
    }
    const classOf = (id: string): string | undefined => {
      const n = nodeById.get(id);
      if (n === undefined) return undefined;
      if (n.type === 'Class') return id;
      if (n.type === 'Method') return sn.ctx.nodeId('Class', n.filePath, n.name.split('.')[0] ?? '');
      return undefined;
    };
    const related = (a: string, b: string): boolean => {
      const na = nodeById.get(a);
      const nb = nodeById.get(b);
      if (na === undefined || nb === undefined) return true;
      const fa = sn.ctx.info(na.filePath).fileNodeId;
      const fb = sn.ctx.info(nb.filePath).fileNodeId;
      if (fa === fb || fileImports.has(`${fa ?? ''}>${fb ?? ''}`) || fileImports.has(`${fb ?? ''}>${fa ?? ''}`)) return true;
      const ca = classOf(a);
      const cb = classOf(b);
      if (ca !== undefined && cb !== undefined) {
        const sa = supertypes.get(ca) ?? new Set<string>();
        const sb = supertypes.get(cb) ?? new Set<string>();
        if (sa.has(cb) || sb.has(ca)) return true;
        for (const x of sa) if (sb.has(x)) return true;
      }
      return false;
    };
    const seen = new Set<string>();
    const emit = (newId: string, oldId: string, via: 'clone' | 'vocabulary', score: number, detail: Record<string, unknown>): void => {
      const k = `${newId}>${oldId}`;
      if (seen.has(k)) return;
      seen.add(k);
      const nn = nodeById.get(newId);
      const on = nodeById.get(oldId);
      if (nn === undefined || on === undefined) return;
      const oldAt = unitChangedAt(oldId, sn.index - 1) ?? 0;
      if (via === 'clone') reimplClone++;
      else reimplVocab++;
      const ev = { file: nn.filePath, startLine: 1, endLine: 1 };
      const oev = { file: on.filePath, startLine: 1, endLine: 1 };
      edges.push({ type: 'REIMPLEMENTS', proxy: 'agent-provenance', sourceId: newId, targetId: oldId, score, evidence: [ev, oev], properties: { via, step: rec(sn.index).turnId, existingSince: rec(oldAt).turnId, ...detail } });
      const [cn, mn] = nn.type === 'Method' ? (nn.name.split('.') as [string, string]) : nn.type === 'Class' ? [nn.name, undefined] : [undefined, nn.name];
      flags.push({
        proxy: 'agent-provenance', kind: 'reimplementation-candidate', score, evidence: ev,
        ...(cn !== undefined ? { className: cn } : {}), ...(mn !== undefined ? { methodName: mn } : {}),
        message: `${rec(sn.index).turnId} added ${nn.type} ${nn.name} that ${via === 'clone' ? 'clones' : 'shares the concept and member vocabulary of'} ${on.type} ${on.name} (${on.filePath}, since ${rec(oldAt).turnId}) instead of reusing it`,
        related: oev,
      });
    };
    for (const e of sn.sameLogic) {
      for (const [a, b] of [[e.sourceId, e.targetId], [e.targetId, e.sourceId]] as const) {
        if (!existedBefore(a) && existedBefore(b) && !related(a, b)) emit(a, b, 'clone', e.score, { similarity: e.score, cloneType: e.properties.cloneType });
      }
    }
    const classes = sn.ctx.sources.flatMap(({ file, sf }) => classesOf(sf).map((c) => ({ id: sn.ctx.nodeId('Class', file, c.getName() ?? ''), voc: classVocabulary(c) })));
    const fresh = classes.filter((c) => c.id !== undefined && !existedBefore(c.id));
    const old = classes.filter((c) => c.id !== undefined && existedBefore(c.id));
    for (const n of fresh) for (const o of old) {
      if (n.id === undefined || o.id === undefined || related(n.id, o.id)) continue;
      const score = vocabularyMatch(n.voc, o.voc, vopts);
      if (score !== null) emit(n.id, o.id, 'vocabulary', score, { concept: [...n.voc.concept].filter((t) => o.voc.concept.has(t)), sharedMembers: [...n.voc.members].filter((t) => o.voc.members.has(t)) });
    }
  }

  // ── Locality ──
  const locality: LocalityRecord[] = snaps.map((sn) => {
    const s = steps[sn.index];
    const src = sn.diff.filter((d) => /\.(ts|tsx|mts|cts)$/.test(d.file) && !d.file.endsWith('.d.ts'));
    const compOf = (f: string): string => (sn.files.has(f) ? sn.ctx.info(f).component : componentOf(f, opts.layerModel));
    const comps = [...new Set(src.map((d) => compOf(d.file)))].sort();
    const layers = [...new Set(src.map((d) => (sn.files.has(d.file) ? sn.ctx.info(d.file).layer : null) ?? '(none)'))].sort();
    let scope = [...new Set(src.filter((d) => d.status === 'A').map((d) => compOf(d.file)))].sort();
    if (scope.length === 0 && src.length > 0) {
      const counts = new Map<string, number>();
      for (const d of src) counts.set(compOf(d.file), (counts.get(compOf(d.file)) ?? 0) + 1);
      scope = [[...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? ''];
    }
    const inScope = src.filter((d) => scope.includes(compOf(d.file))).length;
    return { index: sn.index, turnId: s?.turnId ?? '', filesTouched: src.length, componentsTouched: comps, layersTouched: layers, scope, locality: src.length === 0 ? null : Math.round((inScope / src.length) * 1e4) / 1e4 };
  });

  const { gitArgs: _g, ...historyOut } = history;
  return {
    history: historyOut, apg: last?.apg ?? null, virtualNodes, edges, nodeFacts, edgeFacts, flags, erosion, locality,
    summary: {
      snapshots: snaps.length,
      files: last?.files.size ?? 0,
      edges: edgeFacts.length,
      erosion: erosion.map((e) => ({ turnId: e.turnId, totalBlocking: e.totalBlocking, newBlocking: e.newBlocking, resolvedBlocking: e.resolvedBlocking, totalAdvisory: e.totalAdvisory, newAdvisory: e.newAdvisory, attributed: attributedCount.get(e.index) ?? { blocking: 0, advisory: 0 } })),
      reimplements: { clone: reimplClone, vocabulary: reimplVocab },
      locality: locality.map((l) => ({ turnId: l.turnId, components: l.componentsTouched.length, locality: l.locality })),
    },
  };
}

function stepNodeId(s: ProvenanceStep): string {
  return `step:${String(s.index)}:${s.turnId}`;
}
