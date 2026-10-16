/**
 * The multi-step loop with the dry-run stubs: per-step snapshots and measures, the gate's repair turn, the prompts,
 * evaluator failures, and resume after a stop mid-run. Made-up demo task only; no model, no Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { RESTARTS_LOG, RUN_JSON, WORK_DIR, assertGateApplied, gateEvaluationFailures, readStepRecords, runDirFor, runLoop, stepRecordPath } from '../../../../scripts/lib/loop/loop.js';
import { loopRunId } from '../../../../scripts/lib/loop/plan.js';
import { MAX_REPAIR_FINDINGS, repairPrompt, sha256, stepPrompt } from '../../../../scripts/lib/loop/prompts.js';
import { SNAPSHOT_GIT_DIR, WorkTreeSnapshots } from '../../../../scripts/lib/loop/snapshot.js';
import { stubEvaluator } from '../../../../scripts/lib/loop/stub.js';
import { runOutcomes } from '../../../../scripts/lib/loop/pilot-metrics.js';
import type { BlockingFinding, StepAgent, StepEvaluation, StepEvaluator, StepRecord, TurnInput } from '../../../../scripts/lib/loop/types.js';
import { DEMO_TASK, context, spec, stubAgent, tmpRoot } from './helpers.js';

let out: string;
beforeEach(() => {
  out = tmpRoot();
});
afterEach(() => {
  fs.rmSync(out, { recursive: true, force: true });
});

function snapsOf(runId: string): WorkTreeSnapshots {
  const dir = runDirFor(out, runId);
  return new WorkTreeSnapshots(path.join(dir, SNAPSHOT_GIT_DIR), path.join(dir, WORK_DIR));
}

async function completed(arm: Parameters<typeof spec>[0], agent: StepAgent = stubAgent()): Promise<readonly StepRecord[]> {
  const r = await runLoop(context(out, agent), spec(arm));
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  if (r.data.kind !== 'completed') throw new Error('expected a completed run');
  return r.data.steps;
}

describe('multi-step loop (dry run)', () => {
  it('applies every step to the same work directory and snapshots after each step', async () => {
    const steps = await completed('none');
    expect(steps.map((s) => s.stepId)).toEqual(['todos', 'tags', 'due-dates']);
    const runId = loopRunId(spec('none'));
    expect(runId).toBe('claude-code-cli/stub-model/todo-list/none/run-0');
    const snaps = snapsOf(runId);
    const log = snaps.log();
    expect(log.success && log.data).toEqual(['base: skeleton', 'step-01 none', 'step-02 none', 'step-03 none']);
    // The tree grows step by step in one directory; step 2 plants one blocking violation, kept by step 3.
    expect(steps.map((s) => s.turns[0]?.snapshot.sourceFiles.length)).toEqual([2, 5, 7]);
    expect(steps.map((s) => s.turns[0]?.snapshot.diff)).toEqual([
      { added: 2, modified: 0, deleted: 0 },
      { added: 3, modified: 0, deleted: 0 },
      { added: 2, modified: 0, deleted: 0 },
    ]);
    expect(steps.map((s) => s.turns[0]?.snapshot.evaluation?.blockingViolationCount)).toEqual([0, 1, 1]);
    expect(steps.map((s) => s.turns[0]?.snapshot.evaluation?.ahs)).toEqual([1, 0.9, 0.9]);
    expect(steps.every((s) => s.turns.length === 1 && s.repair === null)).toBe(true);
    // Each record's final commit is the snapshot of its tree; the work dir holds no .git.
    const files = snaps.files(steps[2]?.finalCommit ?? '');
    expect(files.success && files.data).toEqual([
      'package.json',
      'src/application/due-dates-service.ts',
      'src/application/tags-service.ts',
      'src/application/todos-service.ts',
      'src/domain/due-dates.ts',
      'src/domain/tags.ts',
      'src/domain/todos.ts',
      'src/infrastructure/tags-store.ts',
    ]);
    expect(fs.existsSync(path.join(runDirFor(out, runId), WORK_DIR, '.git'))).toBe(false);
  });

  it('records per-step outputs: files, LOC, type-check, evaluation, tokens, cost and wall time', async () => {
    const [s1] = await completed('none');
    if (s1 === undefined) throw new Error('no step');
    const t = s1.turns[0];
    expect(t?.snapshot.sourceFiles).toEqual(['application/todos-service.ts', 'domain/todos.ts']);
    expect(t?.snapshot.loc).toBe(10);
    expect(t?.snapshot.treeFileCount).toBe(2);
    expect(t?.snapshot.typecheck).toEqual({ errors: 0, codes: [] });
    expect(t?.snapshot.evaluation).toMatchObject({ scoringMode: 'v1.3', verdict: 'pass', blockingViolationCount: 0, advisoryViolationCount: 0 });
    expect(t?.snapshot.skeletonIntact).toBe(true);
    expect(t?.result.status).toBe('completed');
    expect(t?.promptSha256).toBe(sha256(stepPrompt(DEMO_TASK, 0, '/h/bin/tsc --noEmit --incremental false -p /h/runs/claude-code-cli/stub-model/todo-list/none/run-0/tsconfig.json')));
    expect(s1.cost.costUsd).toBe(0);
    expect(s1.cost.outputTokens).toBeGreaterThan(0);
    expect(s1.cost.wallMs).toBe(0);
    expect(Date.parse(s1.finishedAt)).toBeGreaterThan(Date.parse(s1.startedAt));
    const runDir = runDirFor(out, s1.runId);
    expect(fs.existsSync(path.join(runDir, 'turns', 'step-01', 'envelope-step-01.json'))).toBe(true);
    const run = JSON.parse(fs.readFileSync(path.join(runDir, RUN_JSON), 'utf8')) as { completedAt?: string; dryRun: boolean; steps: number };
    expect(run).toMatchObject({ dryRun: true, steps: 3 });
    expect(run.completedAt).toBeDefined();
  });

  it('gate: blocking findings get one repair turn whose snapshot becomes the step outcome', async () => {
    const agent = stubAgent();
    const steps = await completed('gate', agent);
    expect(steps.map((s) => s.turns.map((t) => t.turnId))).toEqual([['step-01'], ['step-02', 'step-02-repair'], ['step-03']]);
    expect(steps[0]?.repair).toEqual({ attempted: false, blockingBefore: 0, blockingAfter: null, cleared: null });
    expect(steps[1]?.repair).toEqual({ attempted: true, blockingBefore: 1, blockingAfter: 0, cleared: true });
    expect(steps[1]?.finalCommit).toBe(steps[1]?.turns[1]?.snapshot.commit);
    expect(steps[1]?.turns[1]?.snapshot.diff).toEqual({ added: 0, modified: 1, deleted: 0 });
    // The repair prompt lists the finding by rule, file and line.
    const repairTurn = agent.turns.find((t) => t.kind === 'repair');
    expect(repairTurn?.prompt).toContain("- [STUB-DEP domain must not depend on infrastructure (stub)] src/domain/tags.ts:1 (imports ../infrastructure/tags-store): a domain file imports an infrastructure module");
    expect(repairTurn?.arm).toBe('gate');
    // Step 3 starts from the repaired tree.
    expect(steps[2]?.turns[0]?.snapshot.evaluation?.blockingViolationCount).toBe(0);
    const log = snapsOf(loopRunId(spec('gate'))).log();
    expect(log.success && log.data).toEqual(['base: skeleton', 'step-01 gate', 'step-02 gate', 'step-02-repair gate', 'step-03 gate']);
  });

  it('none and daedalus-mcp never get a repair turn, and every arm sees the same step prompt', async () => {
    const prompts: Record<string, string[]> = {};
    for (const arm of ['none', 'daedalus-mcp', 'gate'] as const) {
      const agent = stubAgent();
      await completed(arm, agent);
      prompts[arm] = agent.turns.filter((t) => t.kind === 'step').map((t) => t.prompt.replace(`/${arm}/`, '/<arm>/'));
      if (arm !== 'gate') expect(agent.turns.every((t) => t.kind === 'step')).toBe(true);
    }
    expect(prompts['daedalus-mcp']).toEqual(prompts.none);
    expect(prompts.gate).toEqual(prompts.none);
  });

  /** An evaluator that fails on its `failOn`-th call (1-based) and otherwise is the stub. */
  function flakyEvaluator(failOn: number, code = 'NEO4J_UNREACHABLE'): StepEvaluator {
    let calls = 0;
    return {
      id: 'flaky',
      evaluate: (dir: string) => {
        calls++;
        return calls === failOn ? Promise.resolve(DomainResult.fail<StepEvaluation>([{ code, message: 'down' }])) : stubEvaluator().evaluate(dir);
      },
    };
  }

  it('none: an evaluator failure is recorded on the snapshot and the run goes on (the commit can be re-scored)', async () => {
    const r = await runLoop(context(out, stubAgent(), { evaluator: flakyEvaluator(2) }), spec('none'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected completion');
    const s2 = r.data.steps[1];
    expect(s2?.turns).toHaveLength(1);
    expect(s2?.turns[0]?.snapshot.evaluation).toBeNull();
    expect(s2?.turns[0]?.snapshot.evaluationError).toEqual({ code: 'NEO4J_UNREACHABLE', message: 'down' });
    expect(s2?.repair).toBeNull();
  });

  it('gate: an unscored step-turn snapshot stops the run (the gate cannot decide), and a resume reruns the step with its repair', async () => {
    // Loop fault drills D4a/D4b (Docs/v1.3/loop-fault-drills.md): recording the error and going on ran the step
    // without the gate (no repair), so the gate arm silently became `none` for that step and every later one.
    const first = await runLoop(context(out, stubAgent(), { evaluator: flakyEvaluator(2) }), spec('gate'));
    expect(first.success ? [] : first.errors.map((e) => e.code)).toEqual(['LOOP_GATE_UNSCORED']);
    if (!first.success) expect(first.errors[0]?.message).toContain('NEO4J_UNREACHABLE');
    const runDir = runDirFor(out, loopRunId(spec('gate')));
    expect(readStepRecords(runDir, 3)).toHaveLength(1);
    const second = await runLoop(context(out, stubAgent()), spec('gate'));
    if (!second.success || second.data.kind !== 'completed') throw new Error('expected completion');
    expect(second.data.resumedFromStep).toBe(1);
    expect(second.data.steps[1]?.repair).toEqual({ attempted: true, blockingBefore: 1, blockingAfter: 0, cleared: true });
    const log = snapsOf(loopRunId(spec('gate'))).log();
    expect(log.success && log.data).toEqual(['base: skeleton', 'step-01 gate', 'step-02 gate', 'step-02-repair gate', 'step-03 gate']);
  });

  it('gate: an unscored repair snapshot is recorded (the gate has acted) and the run goes on', async () => {
    // Calls: step 1, step 2, step-2 repair (fails), step 3.
    const r = await runLoop(context(out, stubAgent(), { evaluator: flakyEvaluator(3) }), spec('gate'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected completion');
    expect(r.data.steps[1]?.repair).toEqual({ attempted: true, blockingBefore: 1, blockingAfter: null, cleared: null });
    expect(r.data.steps[1]?.turns[1]?.snapshot.evaluationError?.code).toBe('NEO4J_UNREACHABLE');
  });

  /** An evaluator that scores its first call and then fails with `code` (undefined: a failure with no error). */
  function failingAfterFirst(code: string | undefined): StepEvaluator {
    let calls = 0;
    return {
      id: 'down',
      evaluate: (dir: string) => {
        calls++;
        if (calls === 1) return stubEvaluator().evaluate(dir);
        // No code: an evaluator result with no error at all, which `DomainResult.fail` itself refuses to build.
        if (code === undefined) return Promise.resolve({ success: false, errors: [] } as unknown as DomainResult<StepEvaluation>);
        return Promise.resolve(DomainResult.fail<StepEvaluation>([{ code, message: 'no evaluation' }]));
      },
    };
  }

  it.each([
    ['LOOP_SPEC_NOT_FROZEN', 'LOOP_SPEC_NOT_FROZEN'],
    ['an empty error code', ''],
    ['a failure with no error at all', undefined],
  ])('gate: %s on a later step stops the run (only LOOP_SPEC_FREEZE_FAILED is exempt)', async (_label, code) => {
    const r = await runLoop(context(out, stubAgent(), { evaluator: failingAfterFirst(code) }), spec('gate'));
    expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['LOOP_GATE_UNSCORED']);
    if (!r.success) expect(r.errors[0]?.message).toContain(code === undefined ? 'no evaluation and no error code' : `${code}: no evaluation`);
    expect(readStepRecords(runDirFor(out, loopRunId(spec('gate'))), 3)).toHaveLength(1);
  });

  it('R01: LOOP_SPEC_FREEZE_FAILED is recorded as a skipped gate, and gateStepsWithoutEvaluation is an assertion that stays 0', async () => {
    // A real failed freeze holds for the whole run, so every snapshot is unscored and the run fails (LOOP_EVAL_ALL_FAILED):
    // no completed run carries a skipped gate step.
    const frozenFail: StepEvaluator = { id: 'down', evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LOOP_SPEC_FREEZE_FAILED', message: 'ise failed' }])) };
    const all = await runLoop(context(out, stubAgent(), { evaluator: frozenFail }), spec('gate'));
    expect(all.success ? [] : all.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_ALL_FAILED']);
    const runDir = runDirFor(out, loopRunId(spec('gate')));
    const records = readStepRecords(runDir, 3);
    expect(records.map((s) => s.repair?.skipped)).toEqual(['evaluation-failed', 'evaluation-failed', 'evaluation-failed']);
    const clean = await runLoop(context(out, stubAgent()), spec('gate', 1));
    if (!clean.success || clean.data.kind !== 'completed') throw new Error('expected completion');
    expect(gateEvaluationFailures([clean.data])).toBe(0);
    expect(assertGateApplied([clean.data]).success).toBe(true);
    // A completed run that did carry one (synthetic) fails the assertion.
    const forged = { ...clean.data, steps: clean.data.steps.map((s, i) => (i === 1 ? { ...s, repair: { attempted: false, blockingBefore: null, blockingAfter: null, cleared: null, skipped: 'evaluation-failed' as const } } : s)) };
    const asserted = assertGateApplied([forged]);
    expect(asserted.success ? [] : asserted.errors.map((e) => e.code)).toEqual(['LOOP_GATE_NOT_APPLIED']);
  });

  it('a step whose evaluation failed is unscored in the outcomes: a null count and total, never 0 (F18)', async () => {
    let calls = 0;
    const flaky: StepEvaluator = {
      id: 'flaky',
      evaluate: (dir: string) => {
        calls++;
        return calls === 2 ? Promise.resolve(DomainResult.fail([{ code: 'NEO4J_UNREACHABLE', message: 'down' }])) : stubEvaluator().evaluate(dir);
      },
    };
    const r = await runLoop(context(out, stubAgent(), { evaluator: flaky }), spec('none'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected completion');
    const o = runOutcomes(r.data.steps);
    // Step 2 planted the violation but was not scored; step 3 still holds it and is flagged as following an
    // unscored step (its count is an upper bound).
    expect(o.newBlocking).toEqual([
      { step: 2, count: null, findings: [] },
      { step: 3, count: 1, findings: expect.any(Array) as unknown, afterUnscored: true },
    ]);
    expect(o.newBlockingTotal).toBeNull();
    expect(o.unscoredSteps).toEqual([2]);
    const clean = runOutcomes(await completed('gate'));
    expect(clean.unscoredSteps).toEqual([]);
    expect(clean.newBlockingTotal).toBe(0);
  });

  it('a run in which every snapshot failed evaluation fails and is never marked complete (F24)', async () => {
    // The none arm: in the gate arm the first unscored step-turn snapshot already stops the run (LOOP_GATE_UNSCORED).
    const down: StepEvaluator = { id: 'down', evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'TSCONFIG_NOT_FOUND', message: 'no tsconfig' }])) };
    const r = await runLoop(context(out, stubAgent(), { evaluator: down }), spec('none'));
    expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_ALL_FAILED']);
    expect(r.success ? '' : r.errors[0]?.message).toContain('all 3 snapshots failed evaluation (TSCONFIG_NOT_FOUND)');
    const runDir = runDirFor(out, loopRunId(spec('none')));
    expect(readStepRecords(runDir, 3)).toHaveLength(3);
    expect((JSON.parse(fs.readFileSync(path.join(runDir, RUN_JSON), 'utf8')) as { completedAt?: string }).completedAt).toBeUndefined();
    // A rerun with the same evaluator does not turn it into a completed run.
    const again = await runLoop(context(out, stubAgent(), { evaluator: down }), spec('none'));
    expect(again.success ? [] : again.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_ALL_FAILED']);
  });

  it('an agent failure stops the run without a step record', async () => {
    const failing: StepAgent = { adapterId: 'claude-code-cli', modelId: 'stub-model', runTurn: () => Promise.resolve(DomainResult.fail([{ code: 'GEN_USAGE_LIMIT_PERSISTS', message: 'x' }])) };
    const r = await runLoop(context(out, failing), spec('none'));
    expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['GEN_USAGE_LIMIT_PERSISTS']);
    expect(readStepRecords(runDirFor(out, loopRunId(spec('none'))), 3)).toHaveLength(0);
  });

  it('refuses an agent of another adapter or model', async () => {
    const r = await runLoop(context(out, stubAgent({ modelId: 'other' })), spec('none'));
    expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['LOOP_AGENT_MISMATCH']);
  });
});

describe('resume', () => {
  /** A stub that writes a partial step-2 tree and then fails, as a crash or a persisting usage limit would. */
  function crashingAt(stepIndex: number): StepAgent {
    const inner = stubAgent();
    return {
      adapterId: inner.adapterId,
      modelId: inner.modelId,
      runTurn: (input: TurnInput) => {
        if (input.stepIndex !== stepIndex) return inner.runTurn(input);
        fs.mkdirSync(path.join(input.cwd, 'src', 'partial'), { recursive: true });
        fs.writeFileSync(path.join(input.cwd, 'src', 'partial', 'half.ts'), 'export const half = 1;\n');
        return Promise.resolve(DomainResult.fail([{ code: 'GEN_USAGE_LIMIT_PERSISTS', message: 'stopped' }]));
      },
    };
  }

  it('a run stopped mid-step resumes at that step from the last snapshot; earlier records are kept', async () => {
    const first = await runLoop(context(out, crashingAt(1)), spec('none'));
    expect(first.success).toBe(false);
    const runDir = runDirFor(out, loopRunId(spec('none')));
    const before = fs.readFileSync(stepRecordPath(runDir, 0), 'utf8');
    expect(readStepRecords(runDir, 3)).toHaveLength(1);

    const agent = stubAgent();
    const second = await runLoop(context(out, agent), spec('none'));
    if (!second.success || second.data.kind !== 'completed') throw new Error('expected completion');
    expect(second.data.resumedFromStep).toBe(1);
    expect(agent.turns.map((t) => t.turnId)).toEqual(['step-02', 'step-03']);
    expect(fs.readFileSync(stepRecordPath(runDir, 0), 'utf8')).toBe(before);
    // The partial files were discarded before step 2 reran.
    expect(fs.existsSync(path.join(runDir, WORK_DIR, 'src', 'partial'))).toBe(false);
    const lines = fs.readFileSync(path.join(runDir, RESTARTS_LOG), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ resumeAtStep: 2, restoredTo: (JSON.parse(before) as StepRecord).finalCommit, discardedChanges: 1 });
    const log = snapsOf(loopRunId(spec('none'))).log();
    expect(log.success && log.data).toEqual(['base: skeleton', 'step-01 none', 'step-02 none', 'step-03 none']);
  });

  it('a step committed but not recorded is discarded and rerun', async () => {
    await runLoop(context(out, crashingAt(2)), spec('none'));
    const runId = loopRunId(spec('none'));
    const snaps = snapsOf(runId);
    // Simulate a stop between the snapshot commit and the step record.
    fs.writeFileSync(path.join(runDirFor(out, runId), WORK_DIR, 'src', 'stray.ts'), 'export {};\n');
    const stray = snaps.commit('step-03 none');
    if (!stray.success) throw new Error('commit failed');
    const r = await runLoop(context(out, stubAgent()), spec('none'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected completion');
    expect(r.data.resumedFromStep).toBe(2);
    const line = JSON.parse(fs.readFileSync(path.join(runDirFor(out, runId), RESTARTS_LOG), 'utf8').trim()) as { discardedHead: string };
    expect(line.discardedHead).toBe(stray.data);
    const files = snaps.files(r.data.steps[2]?.finalCommit ?? '');
    expect(files.success && files.data.includes('src/stray.ts')).toBe(false);
  });

  it('a truncated step record: the resume says which record it could not read and sets it and the later ones aside', async () => {
    const steps = await completed('gate');
    const runDir = runDirFor(out, loopRunId(spec('gate')));
    const f = stepRecordPath(runDir, 1);
    const bytes = fs.readFileSync(f);
    fs.writeFileSync(f, bytes.subarray(0, Math.floor(bytes.length / 2)));
    const third = fs.readFileSync(stepRecordPath(runDir, 2), 'utf8');
    const r = await runLoop(context(out, stubAgent()), spec('gate'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected completion');
    expect(r.data.resumedFromStep).toBe(1);
    const lines = fs.readFileSync(path.join(runDir, RESTARTS_LOG), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      resumeAtStep: 2,
      restoredTo: steps[0]?.finalCommit,
      records: [
        { file: 'steps/step-02.json', state: 'unreadable' },
        { file: 'steps/step-03.json', state: 'after-gap' },
      ],
      setAside: 'discarded/restart-1',
    });
    // The records the rerun replaces are kept, byte for byte, with the turn records of the discarded steps.
    const aside = path.join(runDir, 'discarded', 'restart-1');
    expect(fs.readFileSync(path.join(aside, 'steps', 'step-02.json')).equals(bytes.subarray(0, Math.floor(bytes.length / 2)))).toBe(true);
    expect(fs.readFileSync(path.join(aside, 'steps', 'step-03.json'), 'utf8')).toBe(third);
    expect(fs.existsSync(path.join(aside, 'turns', 'step-02', 'prompt-step-02-repair.txt'))).toBe(true);
  });

  it('turn records of a discarded partial step do not survive into its rerun', async () => {
    // Stop inside the gate's step-2 repair turn: the step turn's prompt, report and envelope and the repair prompt
    // are on disk. The rerun of step 2 is clean (no repair), so a stale repair prompt would be left beside it.
    const inner = stubAgent();
    const crashInRepair: StepAgent = {
      adapterId: inner.adapterId,
      modelId: inner.modelId,
      runTurn: (input: TurnInput) => (input.kind === 'repair' ? Promise.resolve(DomainResult.fail([{ code: 'GEN_USAGE_LIMIT_PERSISTS', message: 'stopped' }])) : inner.runTurn(input)),
    };
    await runLoop(context(out, crashInRepair), spec('gate'));
    const runDir = runDirFor(out, loopRunId(spec('gate')));
    const turnDir = path.join(runDir, 'turns', 'step-02');
    expect(fs.existsSync(path.join(turnDir, 'prompt-step-02-repair.txt'))).toBe(true);
    const clean: StepEvaluator = { id: 'clean', evaluate: (dir: string) => stubEvaluator().evaluate(dir).then((e) => (e.success ? DomainResult.ok({ ...e.data, blockingViolationCount: 0, blockingFindings: [], blockingByRule: {} }) : e)) };
    const r = await runLoop(context(out, stubAgent(), { evaluator: clean }), spec('gate'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected completion');
    expect(r.data.steps[1]?.turns.map((t) => t.turnId)).toEqual(['step-02']);
    expect(fs.readdirSync(turnDir).sort()).toEqual(['envelope-step-02.json', 'prompt-step-02.txt']);
    expect(fs.existsSync(path.join(runDir, 'discarded', 'restart-1', 'turns', 'step-02', 'prompt-step-02-repair.txt'))).toBe(true);
  });

  it('a complete run is skipped without calling the agent', async () => {
    await completed('gate');
    const agent = stubAgent();
    const r = await runLoop(context(out, agent), spec('gate'));
    expect(r.success && r.data.kind).toBe('skipped-complete');
    expect(agent.turns).toHaveLength(0);
  });

  it('a half-created run directory (no run.json) is recreated from scratch', async () => {
    const runDir = runDirFor(out, loopRunId(spec('none')));
    fs.mkdirSync(path.join(runDir, WORK_DIR, 'src'), { recursive: true });
    fs.writeFileSync(path.join(runDir, WORK_DIR, 'src', 'leftover.ts'), 'export {};\n');
    const steps = await completed('none');
    expect(steps[0]?.turns[0]?.snapshot.sourceFiles).not.toContain('leftover.ts');
  });
});

describe('prompts', () => {
  it('step 1 asks for a new system, later steps for an extension; both name the type-check command', () => {
    const p1 = stepPrompt(DEMO_TASK, 0, 'TSC');
    const p2 = stepPrompt(DEMO_TASK, 1, 'TSC');
    expect(p1).toContain('step 1 of 3 of "Todo list (demo)"');
    expect(p1).toContain('building a new TypeScript backend service');
    expect(p2).toContain('step 2 of 3');
    expect(p2).toContain('Extend the existing service; keep every existing feature working.');
    for (const p of [p1, p2]) expect(p).toContain('\nTSC\n');
    expect(p2).toContain(DEMO_TASK.steps[1]?.request);
    expect(() => stepPrompt(DEMO_TASK, 3, 'TSC')).toThrow(RangeError);
  });

  it('the repair prompt lists at most MAX_REPAIR_FINDINGS findings and counts the rest', () => {
    const f = (i: number): BlockingFinding => ({ ruleId: 'FF-S01', ruleName: 'layer dependency', filePath: `src/domain/f${String(i)}.ts`, line: i, message: 'bad import' });
    const p = repairPrompt(Array.from({ length: 45 }, (_, i) => f(i)), 60, 'TSC');
    expect(p).toContain('reported 60 blocking violation(s)');
    expect(p.split('\n').filter((l) => l.startsWith('- [FF-S01'))).toHaveLength(MAX_REPAIR_FINDINGS);
    expect(p).toContain('- … and 20 more');
    expect(repairPrompt([{ ruleId: 'R', ruleName: 'n', filePath: 'src/a.ts', message: 'm' }], 1, 'TSC')).toContain('- [R n] src/a.ts: m');
  });
});
