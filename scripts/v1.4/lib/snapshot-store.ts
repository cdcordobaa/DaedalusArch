/**
 * Snapshot discovery over the committed agent-code stores (v1.4 U10; shared by `snapshot-coverage.ts` and
 * `seeded-recall-agent.ts`). Read-only: nothing under a store is written.
 *
 * Three store shapes:
 * - **loop** (a loop harness `outRoot`): every `runs/**\/run.json`; per step file `steps/step-NN.json`, one snapshot per
 *   turn (`step-NN`, `step-NN-repair`), materialised from the run's `snapshots.git` by `git archive`. The spec is the
 *   step's `evaluatorSpec` (static: repository-relative; frozen-after-step-1: run-relative). The generator is
 *   `<adapterId>/<modelId>` from `run.json`.
 * - **probe** (a floor-probe directory): `<task>/<arm>/snapshots/step-NN/` (a plain tree); the spec is the `spec` field
 *   of the step record beside it (`step-NN.json`, the tool arm `step-NN.post.json`). The generator is the label given
 *   by the caller (the probes record none: they were run by hand).
 * - **plain**: a directory holding `src/`; one snapshot, the spec given by the caller.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkoutCommit } from '../../lib/loop/replay.js';

export type StoreKind = 'loop' | 'probe' | 'plain';

export interface SnapshotRef {
  /** Store-relative id (POSIX). */
  readonly id: string;
  readonly store: StoreKind;
  readonly generator: string;
  readonly task: string;
  readonly arm: string;
  /** Loop: the run (`run-0`); probe and plain: `''`. */
  readonly run: string;
  /** 1-based step number. */
  readonly step: number;
  /** `step-04`, `step-04-repair`. */
  readonly snapshot: string;
  /** Absolute spec path, or null when the store records none. */
  readonly specPath: string | null;
  /** The spec as recorded (repository- or run-relative). */
  readonly specRecorded: string | null;
  /** Copies the snapshot tree into `into` (created). */
  readonly materialise: (into: string) => void;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function walkRunFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
    if (!e.isDirectory()) {
      if (e.name === 'run.json') out.push(path.join(dir, e.name));
      continue;
    }
    if (['work', 'snapshots.git', 'node_modules', 'turns', 'steps', 'calls', 'home', 'spec'].includes(e.name)) continue;
    out.push(...walkRunFiles(path.join(dir, e.name)));
  }
  return out;
}

/** Which shape a store directory has. */
export function storeKind(dir: string): StoreKind {
  if (fs.existsSync(path.join(dir, 'runs')) && fs.statSync(path.join(dir, 'runs')).isDirectory()) return 'loop';
  if (fs.existsSync(path.join(dir, 'src'))) return 'plain';
  return 'probe';
}

interface LoopStepFile {
  readonly stepIndex: number;
  readonly evaluatorSpec?: { readonly kind: 'static' | 'frozen-after-step-1'; readonly path: string };
  readonly turns: readonly { readonly turnId: string; readonly snapshot: { readonly commit: string } }[];
}

function loopSnapshots(store: string, repoRoot: string): SnapshotRef[] {
  const out: SnapshotRef[] = [];
  for (const rf of walkRunFiles(path.join(store, 'runs'))) {
    const runDir = path.dirname(rf);
    const run = readJson(rf) as { runId: string; spec: { adapterId: string; modelId: string; taskId: string; arm: string; runIndex: number } };
    const stepsDir = path.join(runDir, 'steps');
    const stepFiles = fs.existsSync(stepsDir) ? fs.readdirSync(stepsDir).filter((f) => /^step-\d+\.json$/.test(f)).sort() : [];
    for (const sf of stepFiles) {
      const step = readJson(path.join(stepsDir, sf)) as LoopStepFile;
      const es = step.evaluatorSpec;
      const specPath = es === undefined ? null : es.kind === 'static' ? path.resolve(repoRoot, es.path) : path.join(runDir, es.path);
      for (const t of step.turns) {
        out.push({
          id: path.posix.join('runs', run.runId, t.turnId),
          store: 'loop',
          generator: `${run.spec.adapterId}/${run.spec.modelId}`,
          task: run.spec.taskId,
          arm: run.spec.arm,
          run: `run-${String(run.spec.runIndex)}`,
          step: step.stepIndex + 1,
          snapshot: t.turnId,
          specPath,
          specRecorded: es?.path ?? null,
          materialise: (into) => { checkoutCommit(path.join(runDir, 'snapshots.git'), t.snapshot.commit, into); },
        });
      }
    }
  }
  return out.sort((a, b) => cmp(a.id, b.id));
}

function probeSnapshots(store: string, repoRoot: string, generator: string): SnapshotRef[] {
  const out: SnapshotRef[] = [];
  for (const task of fs.readdirSync(store).sort()) {
    const taskDir = path.join(store, task);
    if (!fs.statSync(taskDir).isDirectory()) continue;
    for (const arm of fs.readdirSync(taskDir).sort()) {
      const snapDir = path.join(taskDir, arm, 'snapshots');
      if (!fs.existsSync(snapDir)) continue;
      for (const step of fs.readdirSync(snapDir).filter((s) => /^step-\d+$/.test(s)).sort()) {
        const candidates = [path.join(taskDir, arm, `${step}.json`), path.join(taskDir, arm, `${step}.post.json`)];
        const recFile = candidates.find((f) => fs.existsSync(f));
        const spec = recFile !== undefined ? ((readJson(recFile) as { spec?: string }).spec ?? null) : null;
        out.push({
          id: path.posix.join(task, arm, step),
          store: 'probe',
          generator,
          task,
          arm,
          run: '',
          step: Number(step.slice('step-'.length)),
          snapshot: step,
          specPath: spec === null ? null : path.resolve(repoRoot, spec),
          specRecorded: spec,
          materialise: (into) => { fs.cpSync(path.join(snapDir, step), into, { recursive: true }); },
        });
      }
    }
  }
  return out;
}

export interface DiscoverOptions {
  /** Probe and plain stores: the generator label (they record none). */
  readonly generator?: string;
  /** Plain store: the spec (repository-relative or absolute). */
  readonly spec?: string;
}

/** Every snapshot of a store, sorted by id. */
export function discoverSnapshots(store: string, repoRoot: string, opts: DiscoverOptions = {}): SnapshotRef[] {
  const kind = storeKind(store);
  const generator = opts.generator ?? 'unknown';
  if (kind === 'loop') return loopSnapshots(store, repoRoot);
  if (kind === 'probe') return probeSnapshots(store, repoRoot, generator);
  const spec = opts.spec ?? null;
  return [
    {
      id: path.basename(store),
      store: 'plain',
      generator,
      task: path.basename(store),
      arm: '',
      run: '',
      step: 1,
      snapshot: path.basename(store),
      specPath: spec === null ? null : path.resolve(repoRoot, spec),
      specRecorded: spec,
      materialise: (into) => { fs.cpSync(store, into, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git)$/.test(s) }); },
    },
  ];
}

/**
 * The last snapshot of every trajectory (generator × task × arm × run): the highest step, and within it the last turn
 * (a repair turn after the step turn).
 */
export function finalSnapshots(refs: readonly SnapshotRef[]): SnapshotRef[] {
  const best = new Map<string, SnapshotRef>();
  for (const r of refs) {
    const key = [r.generator, r.task, r.arm, r.run].join('|');
    const cur = best.get(key);
    if (cur === undefined || r.step > cur.step || (r.step === cur.step && cmp(r.snapshot, cur.snapshot) > 0)) best.set(key, r);
  }
  return [...best.values()].sort((a, b) => cmp(a.id, b.id));
}

/** Every file of a materialised tree, POSIX-relative, `node_modules` and `.git` skipped. */
export function treeFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(path.relative(root, p).split(path.sep).join('/'));
    }
  };
  walk(root);
  return out;
}
