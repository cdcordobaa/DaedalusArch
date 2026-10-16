/**
 * Test support for the multi-step loop harness: a temp outRoot, the made-up demo task and a loop context wired to the
 * stubs. No model, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { typecheckCommand } from '../../../../scripts/lib/generators/argv.js';
import type { LoopContext } from '../../../../scripts/lib/loop/loop.js';
import { prepareDryRunWorkDir } from '../../../../scripts/lib/loop/main.js';
import { StubStepAgent, stubEvaluator, stubTypechecker } from '../../../../scripts/lib/loop/stub.js';
import type { StubAgentOptions } from '../../../../scripts/lib/loop/stub.js';
import type { LoopArm, LoopRunSpec, LoopTask, StepAgent } from '../../../../scripts/lib/loop/types.js';

export const DEMO_TASK: LoopTask = {
  id: 'todo-list',
  title: 'Todo list (demo)',
  steps: [
    { id: 'todos', request: 'Create a todo-list service: create, list and complete todo items.' },
    { id: 'tags', request: 'Let users attach tags to todo items.' },
    { id: 'due-dates', request: 'Add an optional due date and list the overdue items.' },
  ],
};

export const TASKS: ReadonlyMap<string, LoopTask> = new Map([[DEMO_TASK.id, DEMO_TASK]]);

export function tmpRoot(prefix = 'loop-'): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

export function spec(arm: LoopArm, runIndex = 0): LoopRunSpec {
  return { adapterId: 'claude-code-cli', modelId: 'stub-model', taskId: DEMO_TASK.id, arm, runIndex };
}

/** Fixed clock: every call advances one second from 2026-01-01. */
export function steppingClock(): () => Date {
  let t = Date.parse('2026-01-01T00:00:00Z');
  return () => new Date((t += 1000));
}

export function stubAgent(options: StubAgentOptions = {}): StubStepAgent {
  return new StubStepAgent(TASKS, options);
}

export function context(outRoot: string, agent: StepAgent = stubAgent(), over: Partial<LoopContext> = {}): LoopContext {
  return {
    outRoot,
    tasks: TASKS,
    agent,
    evaluator: stubEvaluator(),
    typechecker: stubTypechecker(),
    prepareWorkDir: prepareDryRunWorkDir,
    skeletonIntact: () => true,
    typecheckCommand: (runId) => typecheckCommand('/h', runId),
    now: steppingClock(),
    dryRun: true,
    ...over,
  };
}
