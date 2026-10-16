/**
 * Grid-scale stub replay tooling (Docs/v1.3/grid-scale-replay.md): lane split of the seeded schedule, the planted
 * step-3 violation, the merge, and the resume checks. Stub evaluator; no model, no Neo4j.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runDirFor, runLoop } from '../../../../scripts/lib/loop/loop.js';
import { loadLoopPlan, loopRunId, scheduleLoopRuns } from '../../../../scripts/lib/loop/plan.js';
import { StubStepAgent } from '../../../../scripts/lib/loop/stub.js';
import type { LoopTask } from '../../../../scripts/lib/loop/types.js';
import { checkTurns, gridStubScript, laneSchedule, loadLaneRuns, mergeLanes, parseLane, runSignature, scheduleBlocks } from '../../../../scripts/v1.3/lib/grid-scale.js';
import { context, tmpRoot } from '../loop/helpers.js';

const REPO = path.resolve(__dirname, '../../../..');
const TASK: LoopTask = {
  id: 'gym-log',
  title: 'Gym log (test)',
  steps: ['workouts', 'exercises', 'personal-bests', 'plans', 'streaks'].map((id) => ({ id, request: `Add ${id}.` })),
};
const TASKS = new Map([[TASK.id, TASK]]);

function loaded() {
  const r = loadLoopPlan(path.join(REPO, 'experiments/grid-scale/plan.json'), REPO, { binary: '/b', harnessRoot: '/h', outRoot: '/o' });
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

describe('lanes', () => {
  it('parses i/n and rejects the rest', () => {
    expect(parseLane('2/2')).toEqual({ index: 2, of: 2 });
    for (const bad of ['0/2', '3/2', '1', 'a/b', '1/0']) expect(() => parseLane(bad)).toThrow();
  });

  it('the committed plan: 54 blocks of 3 distinct arms; two lanes partition the seeded order and keep it', () => {
    const { plan, tasks } = loaded();
    const blocks = scheduleBlocks(plan, tasks.tasks);
    expect(blocks).toHaveLength(54);
    for (const b of blocks) {
      expect(new Set(b.map((s) => s.arm)).size).toBe(3);
      expect(new Set(b.map((s) => `${s.modelId}/${s.taskId}/${String(s.runIndex)}`)).size).toBe(1);
    }
    const full = scheduleLoopRuns(plan, tasks.tasks).map(loopRunId);
    const lanes = [1, 2].map((index) => laneSchedule(blocks, { index, of: 2 }).map(loopRunId));
    expect(lanes.map((l) => l.length)).toEqual([81, 81]);
    expect([...lanes[0]!, ...lanes[1]!].sort()).toEqual([...full].sort());
    for (const l of lanes) expect(full.filter((id) => l.includes(id))).toEqual(l);
  });
});

describe('grid stub on the loop (stub evaluator)', () => {
  it('gate: one repair turn at step 3, which clears it; none keeps the violation from step 3 on; checks pass', async () => {
    const out = tmpRoot('grid-scale-');
    try {
      const agent = new StubStepAgent(TASKS, { script: gridStubScript });
      for (const arm of ['gate', 'none'] as const) {
        const r = await runLoop(context(out, agent, { tasks: TASKS }), { adapterId: 'claude-code-cli', modelId: 'stub-model', taskId: TASK.id, arm, runIndex: 0 });
        expect(r.success).toBe(true);
      }
      const ids = ['gate', 'none'].map((arm) => `claude-code-cli/stub-model/${TASK.id}/${arm}/run-0`);
      const { runs, missing } = loadLaneRuns(out, ids);
      expect(missing).toEqual([]);
      const [gate, none] = runs;
      expect(gate!.steps.map((s) => s.repair?.attempted)).toEqual([false, false, true, false, false]);
      expect(gate!.steps[2]!.repair?.cleared).toBe(true);
      expect(none!.steps.map((s) => s.turns[0]!.snapshot.evaluation!.blockingViolationCount > 0)).toEqual([false, false, true, true, true]);
      expect(runs.flatMap(checkTurns)).toEqual([]);
      expect(runSignature(gate!)).not.toBe(runSignature(none!));

      // A turn committed twice (what two processes on one out-root produce) shows in the snapshot history.
      const gitDir = path.join(gate!.dir, 'snapshots.git');
      spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', `--git-dir=${gitDir}`, `--work-tree=${path.join(gate!.dir, 'work')}`, 'commit', '-q', '--allow-empty', '-m', 'step-05 gate']);
      expect(checkTurns(gate!).map((p) => p.problem).join('\n')).toMatch(/snapshot history/);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('mergeLanes', () => {
  it('links each run from its lane and lists the missing ones', () => {
    const root = tmpRoot('grid-merge-');
    try {
      const lane = path.join(root, 'o1');
      const id = 'claude-code-cli/m/t/none/run-0';
      fs.mkdirSync(runDirFor(lane, id), { recursive: true });
      fs.writeFileSync(path.join(runDirFor(lane, id), 'run.json'), '{}\n');
      const merged = path.join(root, 'merged');
      const res = mergeLanes(merged, [id, 'claude-code-cli/m/t/gate/run-0'], [lane], { schema: 'loop-schedule/v1' });
      expect(res).toEqual({ linked: 1, missing: ['claude-code-cli/m/t/gate/run-0'] });
      expect(fs.realpathSync(runDirFor(merged, id))).toBe(fs.realpathSync(runDirFor(lane, id)));
      expect(JSON.parse(fs.readFileSync(path.join(merged, 'schedule.json'), 'utf8')).runs).toHaveLength(2);
      expect(() => mergeLanes(merged, [id], [lane], {})).toThrow(/not empty/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
