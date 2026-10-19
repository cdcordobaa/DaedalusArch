/**
 * Test support for the Study 2 evasion check (U5): the planted cases of `tests/fixtures/v1.4-evasion/`, an in-memory
 * io over them, synthetic loaded runs, and a builder of a real loop out-root (schedule, run and step records, and a
 * `snapshots.git` per run) from the cases. Synthetic data only; local git only; no model, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../../../../../src/spec-parser/spec-parser.js';
import type { ParsedSpec } from '../../../../../src/shared/types/spec.js';
import { LOOP_SCHEDULE_JSON } from '../../../../../scripts/lib/loop/main.js';
import { RUN_JSON, runDirFor, stepRecordPath } from '../../../../../scripts/lib/loop/loop.js';
import { SNAPSHOT_GIT_DIR, WorkTreeSnapshots } from '../../../../../scripts/lib/loop/snapshot.js';
import { wholeFileDiff } from '../../../../../scripts/lib/loop/replay.js';
import type { BlockingFinding, LoopArm, RunRecord, StepRecord } from '../../../../../scripts/lib/loop/types.js';
import type { EvasionIO } from '../../../../../scripts/v1.3/lib/evasion/analyse.js';
import { EMPTY_RENAME } from '../../../../../scripts/v1.3/lib/evasion/identity.js';
import type { RenameMap } from '../../../../../scripts/v1.3/lib/evasion/identity.js';
import { readTreeDir } from '../../../../../scripts/v1.3/lib/evasion/import-graph.js';
import type { Tree } from '../../../../../scripts/v1.3/lib/evasion/import-graph.js';
import type { LoadedRun } from '../../../../../scripts/v1.3/lib/study2-analysis.js';

export const REPO = process.cwd();
export const FIX_REL = 'tests/fixtures/v1.4-evasion';
export const FIX = path.join(REPO, FIX_REL);

export const REMOVAL_CASES = ['relocated-unmapped', 'relocated-unguarded', 'wrapped', 'inlined', 'dynamic-escape', 'deleted', 'true-fix-dip', 'cycle', 'stub-specifier-target', 'edgeless', 'tool-tell'] as const;
export const ALL_CASES = [...REMOVAL_CASES, 'avoided', 'rename-only', 'outside-context', 'observed-pair'] as const;

export interface Expected {
  readonly spec: string;
  readonly kind: 'removal' | 'avoided' | null;
  readonly signals: readonly string[];
  readonly class: string;
  readonly edgeless?: number;
  readonly outOfScope?: { readonly unmappedFiles: number; readonly outOfScopeEdges: readonly string[]; readonly declaredOutsideEdges: number };
  readonly observedNotInSpec?: readonly (readonly [string, string])[];
}

export interface Case {
  readonly name: string;
  readonly t0: Tree;
  readonly t1: Tree;
  readonly f0: readonly BlockingFinding[];
  readonly f1: readonly BlockingFinding[];
  readonly rename: RenameMap;
  readonly expected: Expected;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function loadCase(name: string): Case {
  const dir = path.join(FIX, name);
  const renameFile = path.join(dir, 'rename.json');
  const rename: RenameMap = fs.existsSync(renameFile)
    ? { map: new Map(Object.entries(readJson<Record<string, string>>(renameFile))), renameDetection: 'full' }
    : EMPTY_RENAME;
  return {
    name,
    t0: readTreeDir(path.join(dir, 't0')),
    t1: readTreeDir(path.join(dir, 't1')),
    f0: readJson(path.join(dir, 't0.findings.json')),
    f1: readJson(path.join(dir, 't1.findings.json')),
    rename,
    expected: readJson(path.join(dir, 'expected.json')),
  };
}

/** The repository-relative path of a case's spec. */
export function specPathOf(c: Case): string {
  return c.expected.spec.startsWith('specs/') ? c.expected.spec : `${FIX_REL}/${c.expected.spec}`;
}

const specCache = new Map<string, ParsedSpec>();
export async function loadSpec(rel: string): Promise<ParsedSpec> {
  const hit = specCache.get(rel);
  if (hit !== undefined) return hit;
  const r = await parseSpec({ specFilePath: path.join(REPO, rel) });
  if (!r.success) throw new Error(`${rel}: ${r.errors.map((e) => e.message).join('; ')}`);
  specCache.set(rel, r.data);
  return r.data;
}

export function tierText(): { path: string; text: string } {
  return { path: 'Docs/v1.3/rule-tiers.md', text: fs.readFileSync(path.join(REPO, 'Docs/v1.3/rule-tiers.md'), 'utf8') };
}

/** io over the fixture cases: a commit is `<case>/t0` or `<case>/t1`. */
export function fixtureIO(): EvasionIO & { readonly reads: string[] } {
  const reads: string[] = [];
  const tree = (commit: string): Tree => readTreeDir(path.join(FIX, ...commit.split('/')));
  return {
    reads,
    readTree: (_runDir, commit) => {
      reads.push(commit);
      return tree(commit);
    },
    renameMap: (_runDir, a) => loadCase(a.split('/')[0] ?? '').rename,
    diff: (_runDir, a, b) => {
      const ta = tree(a).files;
      const tb = tree(b).files;
      const paths = [...new Set([...ta.keys(), ...tb.keys()])].sort();
      return wholeFileDiff(paths.filter((p) => ta.get(p) !== tb.get(p)).map((p) => ({ path: p, before: ta.get(p) ?? null, after: tb.get(p) ?? null })));
    },
    readSpec: async (ref) => loadSpec(ref.path),
  };
}

const ACCEPT_PASS = { schema: 'loop-acceptance/v1' as const, status: 'ran' as const, passed: 3, failed: 0, skipped: 0, errors: 0, durationMs: 0, testFileSha256: 'x', files: [] };

function stepRecord(run: RunRecord, stepIndex: number, commit: string, findings: readonly BlockingFinding[] | null, spec: string, acceptance: boolean): StepRecord {
  return {
    schema: 'loop-step/v1',
    runId: run.runId,
    spec: run.spec,
    stepIndex,
    stepId: `s${String(stepIndex + 1)}`,
    startedAt: '2026-10-18T00:00:00.000Z',
    finishedAt: '2026-10-18T00:00:00.000Z',
    turns: [
      {
        turnId: `step-${String(stepIndex + 1).padStart(2, '0')}`,
        kind: 'step',
        promptSha256: 'x',
        result: { status: 'completed', usage: { costUsd: null, inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null, numTurns: null, durationMs: null }, wallMs: 0, attempts: [], interruptions: [], argv: [], envelopePath: null, permissionDenials: 0 },
        snapshot: {
          commit,
          sourceFiles: [],
          treeFileCount: 0,
          loc: 10 * (stepIndex + 1),
          diff: { added: 0, modified: 0, deleted: 0 },
          skeletonIntact: true,
          typecheck: { errors: 0, codes: [] },
          evaluation:
            findings === null
              ? null
              : { scoringMode: 'v1.3', ahs: 1, blockingAhs: 1, verdict: findings.length > 0 ? 'fail' : 'pass', violationCount: findings.length, blockingViolationCount: findings.length, advisoryViolationCount: 0, blockingByRule: {}, blockingFindings: findings, durationMs: 0 },
        },
      },
    ],
    repair: null,
    evaluatorSpec: { kind: 'static', path: spec, sha256: null },
    ...(acceptance ? { acceptance: ACCEPT_PASS } : {}),
    finalCommit: commit,
    cost: { costUsd: null, inputTokens: null, outputTokens: null, wallMs: 0 },
  };
}

export interface RunSpecIn {
  readonly caseName: string;
  readonly arm: LoopArm;
  readonly rung?: 'L2' | 'L3';
  readonly runIndex?: number;
  readonly taskId?: string;
  /** Override the commits (default `<case>/t0`, `<case>/t1`). */
  readonly commits?: readonly [string, string];
  readonly acceptance?: boolean;
  readonly evaluated?: readonly [boolean, boolean];
}

export function runRecord(r: RunSpecIn): RunRecord {
  const spec = { adapterId: 'claude-code-cli' as const, modelId: 'stub-model', taskId: r.taskId ?? r.caseName, arm: r.arm, runIndex: r.runIndex ?? 0 };
  return {
    schema: 'loop-run/v1',
    runId: `${spec.adapterId}/${spec.modelId}/${spec.taskId}/${spec.arm}/run-${String(spec.runIndex)}`,
    spec,
    steps: 2,
    baseCommit: 'base',
    createdAt: '2026-10-18T00:00:00.000Z',
    dryRun: true,
    ...(r.rung !== undefined ? { frame: { specRung: r.rung, attention: false } } : {}),
  };
}

/** Synthetic loaded runs over the fixture cases (2 steps: t0, t1). */
export function loadedRuns(specs: readonly RunSpecIn[]): LoadedRun[] {
  return specs.map((r) => {
    const c = loadCase(r.caseName);
    const run = runRecord(r);
    const [a, b] = r.commits ?? [`${r.caseName}/t0`, `${r.caseName}/t1`];
    const ev = r.evaluated ?? [true, true];
    const spec = specPathOf(c);
    return { run, steps: [stepRecord(run, 0, a, ev[0] ? c.f0 : null, spec, r.acceptance ?? true), stepRecord(run, 1, b, ev[1] ? c.f1 : null, spec, r.acceptance ?? true)] };
  });
}

export function tmp(prefix = 'evasion-'): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function writeJson(file: string, v: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(v, null, 2)}\n`);
}

function writeTree(dir: string, tree: Tree): void {
  fs.rmSync(path.join(dir, 'src'), { recursive: true, force: true });
  for (const [rel, text] of tree.files) {
    const abs = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

/** A real loop out-root from the cases: each run's two snapshots are commits of its own `snapshots.git`. */
export function buildGitOutRoot(outRoot: string, specs: readonly RunSpecIn[]): void {
  const runs = loadedRuns(specs);
  writeJson(path.join(outRoot, LOOP_SCHEDULE_JSON), { schema: 'loop-schedule/v1', planSha256: 'x', tasksSha256: 'x', dryRun: true, runs: runs.map((r) => r.run.runId) });
  runs.forEach((lr, i) => {
    const c = loadCase(specs[i]?.caseName ?? '');
    const dir = runDirFor(outRoot, lr.run.runId);
    const work = path.join(dir, 'work');
    fs.mkdirSync(work, { recursive: true });
    const snaps = new WorkTreeSnapshots(path.join(dir, SNAPSHOT_GIT_DIR), work, '2026-10-18T00:00:00Z');
    const ok = snaps.init();
    if (!ok.success) throw new Error(ok.errors[0]?.message);
    const commits: string[] = [];
    for (const t of [c.t0, c.t1]) {
      writeTree(work, t);
      const r = snaps.commit(`step ${String(commits.length + 1)}`);
      if (!r.success) throw new Error(r.errors[0]?.message);
      commits.push(r.data);
    }
    const steps = lr.steps.map((s, k) => ({ ...s, finalCommit: commits[k] ?? '', turns: s.turns.map((t) => ({ ...t, snapshot: { ...t.snapshot, commit: commits[k] ?? '' } })) }));
    writeJson(path.join(dir, RUN_JSON), lr.run);
    steps.forEach((s, k) => writeJson(stepRecordPath(dir, k), s));
  });
}
