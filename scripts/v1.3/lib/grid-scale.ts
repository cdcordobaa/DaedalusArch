/**
 * Full-grid stub replay at Study 2 scale (Docs/v1.3/grid-scale-replay.md): the loop harness run at the planned
 * volume with a stub generator and the real v1.3 firewall on the in-process Cypher interpreter. Tooling, not a
 * measurement: nothing here is an arm effect.
 *
 * - Lanes: the plan's seeded schedule (`scheduleLoopRuns`) is cut into blocks (one block = every arm of one
 *   run index × adapter × task, in the seeded arm order); block b goes to lane `b mod n`. Each lane runs its blocks in
 *   schedule order, with its own harness root and out-root, so a lane is the plain harness on a sub-schedule.
 * - Stub generator (`gridStubScript`): per step a domain entity and an application service under the Clean layout;
 *   step 3 (index 2) also writes an infrastructure store and makes the domain entity import it (one blocking
 *   dependency violation the gate arm must see); the repair turn rewrites that entity without the import.
 * - Merge: a merged out-root holds the full schedule and a symlink per run to its lane's run directory, which is what
 *   the analysis script reads.
 * - Verify: the checks of the doc's pass criterion, computed from the files alone.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RUN_JSON, readStepRecords, runDirFor } from '../../lib/loop/loop.js';
import { LOOP_SCHEDULE_JSON } from '../../lib/loop/main.js';
import { loopRunId, scheduleLoopRuns } from '../../lib/loop/plan.js';
import type { LoopPlanFile } from '../../lib/loop/plan.js';
import type { StubScript } from '../../lib/loop/stub.js';
import type { LoopRunSpec, LoopTask, RunRecord, StepRecord } from '../../lib/loop/types.js';

/** Step index (0-based) at which the stub plants the violation. */
export const VIOLATION_STEP = 2;

export interface Lane {
  readonly index: number;
  readonly of: number;
}

export function parseLane(text: string): Lane {
  const m = /^(\d+)\/(\d+)$/.exec(text);
  const index = Number(m?.[1]);
  const of = Number(m?.[2]);
  if (m === null || of < 1 || index < 1 || index > of) throw new Error(`--lane must be i/n with 1 <= i <= n, got ${JSON.stringify(text)}`);
  return { index, of };
}

/** The seeded schedule in blocks (consecutive `arms.length` runs). */
export function scheduleBlocks(plan: Pick<LoopPlanFile, 'adapters' | 'arms' | 'runs' | 'orderSeed'>, tasks: readonly LoopTask[]): LoopRunSpec[][] {
  const specs = scheduleLoopRuns(plan, tasks);
  const size = plan.arms.length;
  const blocks: LoopRunSpec[][] = [];
  for (let i = 0; i < specs.length; i += size) blocks.push(specs.slice(i, i + size));
  return blocks;
}

/** The runs of one lane, in schedule order. */
export function laneSchedule(blocks: readonly (readonly LoopRunSpec[])[], lane: Lane): LoopRunSpec[] {
  return blocks.filter((_, b) => b % lane.of === lane.index - 1).flat();
}

function pascal(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function entity(name: string, withStore: boolean, storeId: string): string {
  return (
    (withStore ? `import { ${name}Store } from '../infrastructure/${storeId}-store';\n\n` : '') +
    `export interface ${name} {\n  readonly id: string;\n  readonly label: string;\n}\n` +
    (withStore ? `\nexport function save${name}(item: ${name}): void {\n  new ${name}Store().put(item.id);\n}\n` : '')
  );
}

/** The grid stub generator (module header). */
export const gridStubScript: StubScript = (input, task) => {
  const files: Record<string, string | null> = {};
  const planted = task.steps[VIOLATION_STEP];
  if (input.kind === 'repair') {
    if (planted !== undefined) files[`src/domain/${planted.id}.ts`] = entity(pascal(planted.id), false, planted.id);
    return files;
  }
  const step = task.steps[input.stepIndex];
  if (step === undefined) return files;
  const name = pascal(step.id);
  const violate = input.stepIndex === VIOLATION_STEP;
  files[`src/domain/${step.id}.ts`] = entity(name, violate, step.id);
  files[`src/application/${step.id}-service.ts`] =
    `import type { ${name} } from '../domain/${step.id}';\n\n` +
    `export class ${name}Service {\n  private readonly items: ${name}[] = [];\n\n  add(item: ${name}): void {\n    this.items.push(item);\n  }\n\n  list(): readonly ${name}[] {\n    return this.items;\n  }\n}\n`;
  if (violate) files[`src/infrastructure/${step.id}-store.ts`] = `export class ${name}Store {\n  private readonly ids: string[] = [];\n\n  put(id: string): void {\n    this.ids.push(id);\n  }\n}\n`;
  return files;
};

/** Writes the merged out-root: the full schedule and one symlink per run into its lane's out-root. */
export function mergeLanes(mergedRoot: string, fullRuns: readonly string[], laneRoots: readonly string[], schedule: Record<string, unknown>): { linked: number; missing: string[] } {
  if (fs.existsSync(mergedRoot) && fs.readdirSync(mergedRoot).length > 0) throw new Error(`${mergedRoot} is not empty`);
  fs.mkdirSync(mergedRoot, { recursive: true });
  fs.writeFileSync(path.join(mergedRoot, LOOP_SCHEDULE_JSON), `${JSON.stringify({ ...schedule, runs: fullRuns }, null, 2)}\n`);
  let linked = 0;
  const missing: string[] = [];
  for (const id of fullRuns) {
    const src = laneRoots.map((r) => runDirFor(r, id)).find((d) => fs.existsSync(path.join(d, RUN_JSON)));
    if (src === undefined) {
      missing.push(id);
      continue;
    }
    const dst = runDirFor(mergedRoot, id);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.symlinkSync(src, dst, 'dir');
    linked++;
  }
  return { linked, missing };
}

export interface LoadedLaneRun {
  readonly run: RunRecord;
  readonly steps: readonly StepRecord[];
  readonly dir: string;
}

export function loadLaneRuns(outRoot: string, runIds: readonly string[]): { runs: LoadedLaneRun[]; missing: string[] } {
  const runs: LoadedLaneRun[] = [];
  const missing: string[] = [];
  for (const id of runIds) {
    const dir = runDirFor(outRoot, id);
    const file = path.join(dir, RUN_JSON);
    if (!fs.existsSync(file)) {
      missing.push(id);
      continue;
    }
    const run = JSON.parse(fs.readFileSync(file, 'utf8')) as RunRecord;
    runs.push({ run, steps: readStepRecords(dir, run.steps), dir });
  }
  return { runs, missing };
}

/** Run ids of a lane in the order their run directories were created. */
export function executionOrder(runs: readonly LoadedLaneRun[]): string[] {
  return [...runs].sort((a, b) => a.run.createdAt.localeCompare(b.run.createdAt) || a.run.runId.localeCompare(b.run.runId)).map((r) => r.run.runId);
}

export interface TurnCheck {
  readonly runId: string;
  readonly problem: string;
}

/**
 * Per run: every step has one step turn and at most one repair turn, turn ids are unique in the run, and each turn
 * has exactly one envelope on disk (a duplicate envelope or turn id is the sign of a double-run turn after resume).
 */
export function checkTurns(r: LoadedLaneRun): TurnCheck[] {
  const out: TurnCheck[] = [];
  const ids = new Set<string>();
  for (const s of r.steps) {
    const kinds = s.turns.map((t) => t.kind);
    if (kinds.filter((k) => k === 'step').length !== 1 || kinds.filter((k) => k === 'repair').length > 1) out.push({ runId: r.run.runId, problem: `step ${String(s.stepIndex + 1)} turns ${kinds.join(',')}` });
    for (const t of s.turns) {
      if (ids.has(t.turnId)) out.push({ runId: r.run.runId, problem: `turn ${t.turnId} recorded twice` });
      ids.add(t.turnId);
    }
    const turnDir = path.join(r.dir, 'turns', `step-${String(s.stepIndex).padStart(2, '0')}`);
    const envelopes = fs.existsSync(turnDir) ? fs.readdirSync(turnDir).filter((f) => f.startsWith('envelope-')) : [];
    if (envelopes.length !== s.turns.length) out.push({ runId: r.run.runId, problem: `step ${String(s.stepIndex + 1)}: ${String(envelopes.length)} envelopes for ${String(s.turns.length)} turns` });
  }
  return out;
}

/** What should be identical across all replicates and models of one task × arm (the stub is deterministic). */
export function runSignature(r: LoadedLaneRun): string {
  return JSON.stringify(
    r.steps.map((s) => ({
      turns: s.turns.map((t) => ({
        kind: t.kind,
        sourceFiles: t.snapshot.sourceFiles,
        loc: t.snapshot.loc,
        diff: t.snapshot.diff,
        evaluationError: t.snapshot.evaluationError?.code ?? null,
        blocking: t.snapshot.evaluation?.blockingViolationCount ?? null,
        byRule: t.snapshot.evaluation?.blockingByRule ?? null,
        advisory: t.snapshot.evaluation?.advisoryViolationCount ?? null,
      })),
      repair: s.repair,
    })),
  );
}

/** Recursive size in bytes (symlinks not followed). */
export function diskBytes(p: string): number {
  const st = fs.lstatSync(p);
  if (!st.isDirectory()) return st.size;
  let n = 0;
  for (const e of fs.readdirSync(p)) n += diskBytes(path.join(p, e));
  return n;
}

export function idsOf(specs: readonly LoopRunSpec[]): string[] {
  return specs.map(loopRunId);
}
