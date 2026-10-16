/**
 * Loop fault drills (backlog 2026-10-16 #7, S1; readiness gate lines S1, D7, D14): the loop harness meets the faults
 * Study 1 met, with the scripted replay agent of `scripts/lib/loop/replay.ts` (no LLM call anywhere), and must resume
 * to the same bytes as an undisturbed replay. Report: `Docs/v1.3/loop-fault-drills.md`.
 *
 * Engine: `cypher-interp` (the in-process interpreter; no Neo4j). Every drill runs one (task, arm) of the pilot replay
 * tapes in a fresh outRoot, in child processes: phase 1 with the fault armed, phase 2 (and more, if a phase stops
 * again) with no fault, each a fresh process, exactly as an operator re-running the same command would.
 *
 * THIS FILE WAS COMMITTED FIRST WITH ONLY THE DRILL LIST AND THE PASS CRITERION (rule 11); the implementation came in
 * a later commit and did not change either.
 */

/** How the drill reaches the loop. */
export type DrillAgentShape =
  /** `ScriptedStepAgent` as the loop replay uses it. */
  | 'direct'
  /**
   * `ClaudeStepAgent` (E1 argv, `runWithRetries`, envelope parsing, `attemptDisposition`) over a scripted
   * `ProcessRunner` that plays the CLI: the turn's edits come from the same tapes, the stdout is a CLI envelope.
   * Needed for the usage-limit drills, whose classification lives in that path.
   */
  | 'cli';

export interface DrillDef {
  readonly id: string;
  /** The backlog drill this one instantiates (D1..D7). */
  readonly family: 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7';
  readonly taskId: string;
  readonly arm: 'none' | 'gate';
  readonly shape: DrillAgentShape;
  /** The turn whose processing the fault hits (`step-NN` or `step-NN-repair`); D7 has none. */
  readonly turnId: string | null;
  readonly fault:
    | 'sigkill-in-turn'
    | 'sigkill-before-score'
    | 'sigkill-after-score'
    | 'usage-limit-once'
    | 'usage-limit-persists'
    | 'pipeline-throws'
    | 'graph-unreachable'
    | 'tsc-exit-no-diagnostics'
    | 'tsc-spawn-fails'
    | 'enospc-snapshot-store'
    | 'truncate-step-record';
  readonly what: string;
  /** What phase 1 must leave on disk or return so the fault is classified (checked, not just described). */
  readonly expectClassification: string;
}

const MARKET = 'market-vendors';
const RELIEF = 'relief-volunteers';

export const DRILLS: readonly DrillDef[] = Object.freeze([
  {
    id: 'D1a',
    family: 'D1',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'sigkill-in-turn',
    what: 'SIGKILL inside the step-3 turn, after its edits are on disk and before the turn returns (no commit).',
    expectClassification: 'process killed by SIGKILL; resume logs the discarded partial step in restarts.jsonl (resumeAtStep 3, discardedChanges > 0)',
  },
  {
    id: 'D1b',
    family: 'D1',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02-repair',
    fault: 'sigkill-in-turn',
    what: "SIGKILL inside the gate's step-2 repair turn (the step turn is committed and scored; the repair's edits are on disk).",
    expectClassification: 'process killed by SIGKILL; resume logs the discarded partial step (resumeAtStep 2, discardedHead = the step-2 step-turn commit)',
  },
  {
    id: 'D2a',
    family: 'D2',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'sigkill-before-score',
    what: 'SIGKILL after the step-2 snapshot commit, when the type-check of record starts (before any scoring).',
    expectClassification: 'process killed by SIGKILL; resume logs the discarded partial step (resumeAtStep 2, discardedHead = the unscored commit)',
  },
  {
    id: 'D2b',
    family: 'D2',
    taskId: RELIEF,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-01',
    fault: 'sigkill-after-score',
    what: 'DDD task: SIGKILL right after the step-1 evaluation, when the spec is already frozen in spec/ and no step record exists.',
    expectClassification: 'process killed by SIGKILL; resume logs the discarded step 1 and re-freezes the spec from the rerun step 1',
  },
  {
    id: 'D3a',
    family: 'D3',
    taskId: MARKET,
    arm: 'gate',
    shape: 'cli',
    turnId: 'step-02',
    fault: 'usage-limit-once',
    what: "The CLI's first step-2 call writes part of the step and answers the E1 usage-limit envelope (exit 1, \"You've hit your limit · resets …|<epoch>\"); the retry policy pauses (injected sleeper) and the same turn resumes.",
    expectClassification: "phase 1 completes; the step-2 turn records one interruption (interruptions[0].movedTo = interruptions/<runId>/step-02/0) and the archived partial tree exists",
  },
  {
    id: 'D3b',
    family: 'D3',
    taskId: MARKET,
    arm: 'gate',
    shape: 'cli',
    turnId: 'step-03',
    fault: 'usage-limit-persists',
    what: 'The usage limit persists beyond the policy (maxInterruptions = 1 in this drill, two limit envelopes in a row): the run stops.',
    expectClassification: 'phase 1 fails with GEN_USAGE_LIMIT_PERSISTS and no step-3 record; resume reruns step 3',
  },
  {
    id: 'D4a',
    family: 'D4',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'pipeline-throws',
    what: "cypher-interp: the evaluation pipeline throws on the step-2 step-turn snapshot (the step the gate must repair).",
    expectClassification: 'the evaluation error (PIPELINE_FAILED) is recorded or stops the run; the gate never proceeds as if the step were clean',
  },
  {
    id: 'D4b',
    family: 'D4',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'graph-unreachable',
    what: 'The --engine neo4j failure mode without a server: the graph health check fails on the step-2 snapshot (NEO4J_UNREACHABLE).',
    expectClassification: 'NEO4J_UNREACHABLE recorded or stops the run; the gate never proceeds as if the step were clean',
  },
  {
    id: 'D4c',
    family: 'D4',
    taskId: MARKET,
    arm: 'none',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'pipeline-throws',
    what: 'The same thrown pipeline error in the none arm (no decision depends on the score).',
    expectClassification: 'PIPELINE_FAILED recorded as the step-2 snapshot evaluationError',
  },
  {
    id: 'D5a',
    family: 'D5',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'tsc-exit-no-diagnostics',
    what: 'The type-check of record exits 2 with no diagnostics on the step-3 snapshot (E1 harnessTypechecker mapping, fake runner).',
    expectClassification: 'the snapshot carries the synthetic code TSC_EXIT_2 (not a TS diagnostic)',
  },
  {
    id: 'D5b',
    family: 'D5',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'tsc-spawn-fails',
    what: 'The type-check of record cannot be spawned on the step-3 snapshot.',
    expectClassification: 'phase 1 fails with PROCESS_SPAWN_FAILED and no step-3 record',
  },
  {
    id: 'D6',
    family: 'D6',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'enospc-snapshot-store',
    what: 'The snapshot store sits on a tmpfs that is full when the step-3 snapshot is committed (real ENOSPC); the filler is removed before resume.',
    expectClassification: 'phase 1 fails with LOOP_SNAPSHOT_GIT naming the space error, and no step-3 record',
  },
  {
    id: 'D7',
    family: 'D7',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: null,
    fault: 'truncate-step-record',
    what: 'A completed run whose steps/step-02.json is cut to half its bytes.',
    expectClassification: 'resume says why it reruns from step 2 (the step-2 record is unreadable), not only that it does',
  },
] satisfies DrillDef[]);

/**
 * The pass criterion, fixed before any drill ran. A drill passes iff all three hold:
 *
 * (i) Classified. Phase 1 leaves the fault visible as `expectClassification` says (a process signal or failure code,
 *     an interruption, an evaluation error, a type-check code, or a restart line that says why).
 * (ii) Byte-identical after resume. Phases 2.. run with no fault until the run completes; then the drill's outRoot
 *     equals the undisturbed replay of the same (task, arm, agent shape) under `canonicalTree` / `compareReplays` of
 *     `scripts/lib/loop/replay-verify.ts` (#142's comparer: timing keys zeroed, `timing-*.json` excluded, snapshot
 *     stores compared by `git log` of commit, tree and subject), EXCEPT the fault record itself, and nothing else:
 *       - `runs/<runId>/restarts.jsonl`;
 *       - `runs/<runId>/discarded/**` (partial-step records set aside by a resume, if the harness keeps any);
 *       - `interruptions/**` (usage-limit archives);
 *       - for D3a only, the `result.interruptions` array of the faulted turn in its step record.
 * (iii) No duplicated turn, no skipped step, no silent arm conversion: per step, the list of turn kinds, the repair
 *     record and the final commit equal the undisturbed replay's (implied by (ii); checked and reported separately so
 *     a failure names its kind).
 *
 * A drill that fails (ii) or (iii) is a defect. A defect that makes the gate arm behave as `none` (R01 family) is
 * blocking and is fixed with a failing test first; other defects are fixed only when they are pure bug fixes with a
 * test, otherwise reported for the author. Nothing about the clean path may change: the undisturbed replays must still
 * match each other byte for byte.
 */
export const PASS_CRITERION_VERSION = 'loop-fault-drills/pass/v1';

// ---------------------------------------------------------------------------------------------------------------------
// Implementation (added after the drill list and the pass criterion were committed).
// ---------------------------------------------------------------------------------------------------------------------

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import type { EvaluateDeps } from '../../src/mcp-server/evaluate-project.js';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { GraphRepository } from '../../src/shared/interfaces/graph-repository.js';
import type { ProcessResult, ProcessRunner } from '../../src/shared/interfaces/process-runner.js';
import { createGeneratorCliConfig } from '../lib/generators/config.js';
import { DEFAULT_RETRY_POLICY } from '../lib/generators/retry.js';
import { ClaudeStepAgent } from '../lib/loop/agents.js';
import { harnessTypechecker } from '../lib/loop/evaluator.js';
import { RESTARTS_LOG, readStepRecords, runDirFor, stepRecordPath } from '../lib/loop/loop.js';
import { loopRunId } from '../lib/loop/plan.js';
import { REPLAY_TAPES } from '../lib/loop/replay-tapes.js';
import { REPLAY_EPOCH, REPLAY_MODEL_ID, runReplay } from '../lib/loop/replay.js';
import type { ScriptedStepAgent } from '../lib/loop/replay.js';
import { TIMING_KEYS, compareReplays } from '../lib/loop/replay-verify.js';
import { SNAPSHOT_GIT_DIR } from '../lib/loop/snapshot.js';
import { CLAUDE_CODE_ADAPTER_ID } from '../lib/generators/types.js';
import type { LoopRunSpec, StepAgent, StepRecord, StepTypechecker, TurnInput } from '../lib/loop/types.js';

/** Run from the repository root (as `npm run loop:replay`). */
const REPO_ROOT = process.cwd();
const SELF = path.join(REPO_ROOT, 'scripts', 'v1.3', 'loop-fault-drills.ts');
/** The CLI the `cli` shape plays (never spawned: the scripted runner answers for it). */
const SCRIPTED_CLI = '/opt/loop-fault-drills/claude';
/** The E1 CLI limit message (the classifier's `you've hit your limit` pattern; reset epoch as the CLI prints it). */
const LIMIT_RESULT = "You've hit your limit · resets 3pm|1767225600";
const STORE_FILLER = 'drill-filler.bin';
const MAX_PHASES = 4;

interface ChildConfig {
  readonly drillId: string | null;
  readonly taskId: string;
  readonly arm: 'none' | 'gate';
  readonly shape: DrillAgentShape;
  readonly outRoot: string;
  readonly harnessRoot: string;
  readonly apgStore: string;
  /** Null: no fault (a reference run, or a resume phase). */
  readonly fault: { readonly kind: DrillDef['fault']; readonly turnId: string } | null;
  readonly resultFile: string;
  /** Mount points the ENOSPC drill created (the parent unmounts them). */
  readonly mountsFile: string;
}

interface ChildResult {
  readonly ok: boolean;
  readonly kind?: string;
  readonly errors?: readonly { readonly code: string; readonly message: string }[];
}

function specOf(c: Pick<ChildConfig, 'taskId' | 'arm'>): LoopRunSpec {
  return { adapterId: CLAUDE_CODE_ADAPTER_ID, modelId: REPLAY_MODEL_ID, taskId: c.taskId, arm: c.arm, runIndex: 0 };
}

function okProcess(stdout: string, exitCode = 0): DomainResult<ProcessResult> {
  return DomainResult.ok({ exitCode, stdout, stderr: '', timedOut: false, durationMs: 0 });
}

function successEnvelope(): string {
  // No cost and no turn count: nothing reads a scripted turn as a free model turn.
  return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'scripted', session_id: 'scripted', modelUsage: { [REPLAY_MODEL_ID]: { outputTokens: 0 } } });
}

function limitEnvelope(): string {
  return JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result: LIMIT_RESULT, session_id: 'scripted', modelUsage: {} });
}

function sh(cmd: string, args: readonly string[]): void {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr}`);
}

/** Moves the run's snapshot store onto a tmpfs just big enough for it, then fills the tmpfs (real ENOSPC). */
function fillSnapshotStore(store: string, mountsFile: string): void {
  const copy = `${store}.drill-copy`;
  sh('cp', ['-a', store, copy]);
  const du = spawnSync('du', ['-sk', copy], { encoding: 'utf8' });
  const kb = Number(du.stdout.split(/\s/)[0] ?? '0') + 1024;
  sh('mount', ['-t', 'tmpfs', '-o', `size=${String(kb)}k`, 'tmpfs', store]);
  fs.appendFileSync(mountsFile, `${store}\n`);
  sh('cp', ['-a', `${copy}/.`, store]);
  fs.rmSync(copy, { recursive: true, force: true });
  const fd = fs.openSync(path.join(store, STORE_FILLER), 'w');
  const chunk = Buffer.alloc(64 * 1024);
  try {
    for (let size = chunk.length; size >= 512; ) {
      try {
        fs.writeSync(fd, chunk, 0, size);
      } catch {
        size = Math.floor(size / 2);
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** One replay of one (task, arm) in this process, with at most one fault armed. */
async function child(c: ChildConfig): Promise<ChildResult> {
  const fault = c.fault;
  const st = { current: null as string | null, fired: 0 };
  const here = (...kinds: DrillDef['fault'][]): boolean => fault !== null && kinds.includes(fault.kind) && st.current === fault.turnId;
  const kill = (): never => {
    process.kill(process.pid, 'SIGKILL');
    throw new Error('unreachable');
  };
  const evaluateDeps: EvaluateDeps = {
    connectTimeoutMs: 1000,
    makeGraph: () => {
      if (here('graph-unreachable') && st.fired === 0) {
        st.fired++;
        const down = { healthCheck: () => Promise.resolve(false), close: () => Promise.resolve() };
        return down as unknown as GraphRepository;
      }
      return new MemoryGraphRepository();
    },
    makePipeline: (config) => {
      const bundle = createPipeline({ ...config, graphEngine: 'cypher-interp' });
      if (here('pipeline-throws') && st.fired === 0) {
        st.fired++;
        return { executor: { execute: () => Promise.reject(new Error('drill: injected pipeline failure')) } as unknown as typeof bundle.executor, cleanup: bundle.cleanup };
      }
      if (here('sigkill-after-score')) {
        const inner = bundle.executor;
        const executor = { execute: async () => { await inner.execute(); return kill(); } } as unknown as typeof bundle.executor;
        return { executor, cleanup: bundle.cleanup };
      }
      return bundle;
    },
  };
  const typecheckerDecorator = (inner: StepTypechecker): StepTypechecker => ({
    typecheck: (runId, cwd) => {
      if (here('sigkill-before-score')) kill();
      if (here('tsc-exit-no-diagnostics', 'tsc-spawn-fails') && st.fired === 0) {
        st.fired++;
        const spawnFails = fault?.kind === 'tsc-spawn-fails';
        const runner: ProcessRunner = {
          run: () =>
            Promise.resolve(spawnFails ? DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: 'drill: tsc could not be spawned' }]) : okProcess('', 2)),
        };
        return harnessTypechecker(runner, c.harnessRoot).typecheck(runId, cwd);
      }
      return inner.typecheck(runId, cwd);
    },
  });
  const directDecorator = (scripted: ScriptedStepAgent): StepAgent => ({
    adapterId: scripted.adapterId,
    modelId: scripted.modelId,
    runTurn: async (input) => {
      st.current = input.turnId;
      const r = await scripted.runTurn(input);
      if (here('sigkill-in-turn')) kill();
      if (here('enospc-snapshot-store')) fillSnapshotStore(path.join(runDirFor(c.outRoot, input.runId), SNAPSHOT_GIT_DIR), c.mountsFile);
      return r;
    },
  });
  const cliDecorator = (scripted: ScriptedStepAgent): StepAgent => {
    let currentInput: TurnInput | null = null;
    let limits = fault?.kind === 'usage-limit-once' ? 1 : fault?.kind === 'usage-limit-persists' ? 2 : 0;
    const runner: ProcessRunner = {
      run: async (command) => {
        const input = currentInput;
        if (command !== SCRIPTED_CLI || input === null) return DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: `unexpected command ${command}` }]);
        if (here('usage-limit-once', 'usage-limit-persists') && limits > 0) {
          limits--;
          // Part of the step is on disk when the limit hits (the first file of the step's edits).
          const step = REPLAY_TAPES.find((t) => t.taskId === input.taskId)?.steps[input.stepIndex];
          const first = Object.entries(step?.edits ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))[0];
          if (first !== undefined && first[1] !== null) {
            fs.mkdirSync(path.dirname(path.join(input.cwd, first[0])), { recursive: true });
            fs.writeFileSync(path.join(input.cwd, first[0]), first[1]);
          }
          return okProcess(limitEnvelope(), 1);
        }
        const r = await scripted.runTurn(input);
        return r.success ? okProcess(successEnvelope()) : DomainResult.fail(r.errors);
      },
    };
    const config = createGeneratorCliConfig({ binary: SCRIPTED_CLI, modelId: REPLAY_MODEL_ID, outputRoot: c.outRoot, harnessRoot: c.harnessRoot }, REPO_ROOT);
    if (!config.success) throw new Error(config.errors.map((e) => e.message).join('; '));
    const fixed = Date.parse(REPLAY_EPOCH);
    const agent = new ClaudeStepAgent(config.data, {
      runner,
      parentEnv: {},
      policy: { ...DEFAULT_RETRY_POLICY, maxInterruptions: 1 },
      clock: { now: () => fixed },
      sleep: () => Promise.resolve(),
    });
    return {
      adapterId: agent.adapterId,
      modelId: agent.modelId,
      runTurn: (input) => {
        st.current = input.turnId;
        currentInput = input;
        return agent.runTurn(input);
      },
    };
  };
  const tape = REPLAY_TAPES.find((t) => t.taskId === c.taskId);
  if (tape === undefined) return { ok: false, errors: [{ code: 'DRILL_TAPE', message: `no tape ${c.taskId}` }] };
  const r = await runReplay({
    repoRoot: REPO_ROOT,
    outRoot: c.outRoot,
    harnessRoot: c.harnessRoot,
    evaluatorEnv: { NEO4J_PASSWORD: 'unused-by-cypher-interp', APG_STORE_PATH: c.apgStore },
    evaluateDeps,
    tapes: [tape],
    arms: [c.arm],
    decorate: { agent: c.shape === 'cli' ? cliDecorator : directDecorator, typechecker: typecheckerDecorator },
  });
  if (!r.success) return { ok: false, errors: r.errors.map((e) => ({ code: e.code, message: e.message })) };
  return { ok: true, kind: r.data.runs[0]?.result.kind ?? 'none' };
}

// --- parent ----------------------------------------------------------------------------------------------------------

interface PhaseOutcome {
  readonly phase: number;
  readonly armed: boolean;
  readonly signal: string | null;
  readonly exitCode: number | null;
  readonly result: ChildResult | null;
}

function runChild(c: ChildConfig, phase: number): PhaseOutcome {
  const cfgFile = `${c.resultFile}.config.json`;
  fs.writeFileSync(cfgFile, JSON.stringify(c));
  fs.rmSync(c.resultFile, { force: true });
  // `node --import tsx`, not the tsx launcher: the launcher would not report the child's own SIGKILL.
  const r = spawnSync(process.execPath, ['--import', 'tsx', SELF, '--child', cfgFile], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  const result = fs.existsSync(c.resultFile) ? (JSON.parse(fs.readFileSync(c.resultFile, 'utf8')) as ChildResult) : null;
  if (result === null && r.signal !== 'SIGKILL') process.stderr.write(`[drills] phase ${String(phase)} produced no result: ${r.stderr.slice(-2000)}\n`);
  return { phase, armed: c.fault !== null, signal: r.signal, exitCode: r.status, result };
}

function zeroTiming(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(zeroTiming);
  if (typeof v === 'object' && v !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = TIMING_KEYS.includes(k) && typeof x === 'number' ? 0 : zeroTiming(x);
    return out;
  }
  return v;
}

interface Layout {
  readonly base: string;
  readonly outRoot: string;
  readonly harnessRoot: string;
  readonly apgStore: string;
  readonly mountsFile: string;
}

/**
 * Every replay runs at the same absolute path (the CLI-shaped records name the harness root in their argv), one at a
 * time; a reference is then moved aside, a drill is compared in place and removed.
 */
const ACTIVE = path.join(os.tmpdir(), 'loop-fault-drills-active');

function layoutAt(base: string): Layout {
  return { base, outRoot: path.join(base, 'out'), harnessRoot: path.join(base, 'harness'), apgStore: path.join(base, 'apg'), mountsFile: path.join(base, 'mounts.txt') };
}

function freshActive(): Layout {
  fs.rmSync(ACTIVE, { recursive: true, force: true });
  fs.mkdirSync(ACTIVE, { recursive: true });
  return layoutAt(fs.realpathSync(ACTIVE));
}

function unmountAll(l: Layout): void {
  if (!fs.existsSync(l.mountsFile)) return;
  for (const m of fs.readFileSync(l.mountsFile, 'utf8').split('\n').filter((x) => x !== '')) spawnSync('umount', [m]);
  fs.rmSync(l.mountsFile, { force: true });
}

function cfg(l: Layout, d: Pick<DrillDef, 'taskId' | 'arm' | 'shape'>, drillId: string | null, fault: ChildConfig['fault'], phase: number): ChildConfig {
  return { drillId, taskId: d.taskId, arm: d.arm, shape: d.shape, outRoot: l.outRoot, harnessRoot: l.harnessRoot, apgStore: l.apgStore, fault, resultFile: path.join(l.base, `phase-${String(phase)}.json`), mountsFile: l.mountsFile };
}

interface Reference {
  readonly key: string;
  readonly layout: Layout;
  /** Two undisturbed replays of the same (task, arm, shape) are byte-identical (the clean path is unchanged). */
  readonly selfIdentical: boolean;
  readonly digest: string;
}

function referenceFor(d: Pick<DrillDef, 'taskId' | 'arm' | 'shape'>, cache: Map<string, Reference>): Reference {
  const key = `${d.taskId}/${d.arm}/${d.shape}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const run = (): Layout => {
    const l = freshActive();
    const p = runChild(cfg(l, d, null, null, 1), 1);
    if (p.result?.ok !== true) throw new Error(`reference ${key} failed: ${JSON.stringify(p)}`);
    return l;
  };
  run();
  const kept = layoutAt(fs.mkdtempSync(path.join(os.tmpdir(), 'loop-fault-drills-ref-')));
  fs.rmSync(kept.base, { recursive: true, force: true });
  fs.renameSync(ACTIVE, kept.base);
  const second = run();
  const cmp = compareReplays(kept.outRoot, second.outRoot);
  fs.rmSync(ACTIVE, { recursive: true, force: true });
  const ref = { key, layout: kept, selfIdentical: cmp.identical, digest: cmp.digest };
  cache.set(key, ref);
  return ref;
}

const ALLOWED = [/^interruptions\//, /^runs\/.+\/restarts\.jsonl$/, /^runs\/.+\/discarded\//];

interface StepShape {
  readonly step: number;
  readonly kinds: readonly string[];
  readonly repair: unknown;
  readonly finalCommit: string;
}

function shapes(runDir: string, steps: number): StepShape[] {
  return readStepRecords(runDir, steps).map((s) => ({ step: s.stepIndex + 1, kinds: s.turns.map((t) => t.kind), repair: s.repair, finalCommit: s.finalCommit }));
}

interface DrillReport {
  readonly id: string;
  readonly family: string;
  readonly target: string;
  readonly fault: string;
  readonly turnId: string | null;
  readonly phases: readonly PhaseOutcome[];
  readonly classification: { readonly ok: boolean; readonly observed: string };
  readonly resumed: boolean;
  readonly bytes: { readonly identical: boolean; readonly differing: readonly string[]; readonly allowedFaultRecord: readonly string[] };
  readonly shape: { readonly ok: boolean; readonly detail: string };
  readonly pass: boolean;
}

function restartLines(runDir: string): Record<string, unknown>[] {
  const f = path.join(runDir, RESTARTS_LOG);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

function classify(d: DrillDef, phases: readonly PhaseOutcome[], runDir: string, outRoot: string, runId: string): { ok: boolean; observed: string } {
  const p1 = phases[0];
  const errs = (p1?.result?.errors ?? []).map((e) => `${e.code}: ${e.message}`);
  const restarts = restartLines(runDir);
  const firstRestart = restarts[0];
  const stepRec = (n: number): StepRecord | null => {
    try {
      return JSON.parse(fs.readFileSync(stepRecordPath(runDir, n - 1), 'utf8')) as StepRecord;
    } catch {
      return null;
    }
  };
  const stepOf = Number((d.turnId ?? 'step-00').slice(5, 7));
  switch (d.fault) {
    case 'sigkill-in-turn':
    case 'sigkill-before-score':
    case 'sigkill-after-score': {
      const ok = p1?.signal === 'SIGKILL' && firstRestart?.resumeAtStep === stepOf && (d.fault !== 'sigkill-in-turn' || d.turnId?.endsWith('repair') === true || Number(firstRestart.discardedChanges) > 0);
      return { ok, observed: `phase 1 signal ${String(p1?.signal)}; restart ${JSON.stringify(firstRestart ?? null)}` };
    }
    case 'usage-limit-once': {
      const t = stepRec(stepOf)?.turns[0];
      const moved = t?.result.interruptions[0]?.movedTo;
      const ok = p1?.result?.ok === true && t?.result.interruptions.length === 1 && moved === `interruptions/${runId}/${d.turnId ?? ''}/0` && fs.existsSync(path.join(outRoot, ...(moved ?? 'x').split('/')));
      return { ok, observed: `phase 1 ok=${String(p1?.result?.ok)}; interruptions ${JSON.stringify(t?.result.interruptions ?? null)}; attempts ${JSON.stringify(t?.result.attempts ?? null)}` };
    }
    case 'usage-limit-persists':
    case 'tsc-spawn-fails':
    case 'enospc-snapshot-store': {
      const want = d.fault === 'usage-limit-persists' ? /^GEN_USAGE_LIMIT_PERSISTS/ : d.fault === 'tsc-spawn-fails' ? /^PROCESS_SPAWN_FAILED/ : /^LOOP_SNAPSHOT_GIT: .*(space|ENOSPC)/i;
      const ok = p1?.result?.ok === false && errs.some((e) => want.test(e)) && firstRestart?.resumeAtStep === stepOf;
      return { ok, observed: `phase 1 errors ${JSON.stringify(errs)}; restart ${JSON.stringify(firstRestart ?? null)}` };
    }
    case 'pipeline-throws':
    case 'graph-unreachable': {
      const code = d.fault === 'pipeline-throws' ? 'PIPELINE_FAILED' : 'NEO4J_UNREACHABLE';
      const recorded = phases.map((p) => p.result?.errors ?? []).flat().some((e) => e.code.includes(code) || e.message.includes(code));
      const s = stepRec(stepOf);
      const onRecord = s?.turns.some((t) => t.snapshot.evaluationError?.code === code) === true;
      return { ok: recorded || onRecord, observed: `phase 1 errors ${JSON.stringify(errs)}; step ${String(stepOf)} evaluationError ${JSON.stringify(s?.turns.map((t) => t.snapshot.evaluationError ?? null) ?? null)}; repair ${JSON.stringify(s?.repair ?? null)}` };
    }
    case 'tsc-exit-no-diagnostics': {
      const codes = stepRec(stepOf)?.turns[0]?.snapshot.typecheck?.codes ?? [];
      const viaFailure = errs.some((e) => e.includes('TSC_EXIT_2'));
      return { ok: codes.includes('TSC_EXIT_2') || viaFailure, observed: `phase 1 errors ${JSON.stringify(errs)}; step ${String(stepOf)} typecheck codes ${JSON.stringify(codes)}` };
    }
    case 'truncate-step-record': {
      const why = JSON.stringify(firstRestart ?? null);
      return { ok: firstRestart?.resumeAtStep === 2 && /step-02\.json/.test(why), observed: `restart ${why}` };
    }
  }
}

function runDrill(d: DrillDef, refs: Map<string, Reference>): DrillReport {
  const ref = referenceFor(d, refs);
  const l = freshActive();
  const runId = loopRunId(specOf(d));
  const runDir = runDirFor(l.outRoot, runId);
  const steps = REPLAY_TAPES.find((t) => t.taskId === d.taskId)?.steps.length ?? 0;
  const phases: PhaseOutcome[] = [];
  try {
    const armed = d.turnId === null ? null : { kind: d.fault, turnId: d.turnId };
    phases.push(runChild(cfg(l, d, d.id, armed, 1), 1));
    if (d.fault === 'truncate-step-record') {
      const f = stepRecordPath(runDir, 1);
      const bytes = fs.readFileSync(f);
      fs.writeFileSync(f, bytes.subarray(0, Math.floor(bytes.length / 2)));
    }
    if (d.fault === 'enospc-snapshot-store') fs.rmSync(path.join(runDir, SNAPSHOT_GIT_DIR, STORE_FILLER), { force: true });
    for (let p = 2; p <= MAX_PHASES; p++) {
      const last = phases[phases.length - 1];
      if (p > 2 && last?.result?.ok === true) break;
      const o = runChild(cfg(l, d, d.id, null, p), p);
      phases.push(o);
      if (o.result?.ok === true) break;
    }
    const resumed = phases[phases.length - 1]?.result?.ok === true && readStepRecords(runDir, steps).length === steps;
    const classification = classify(d, phases, runDir, l.outRoot, runId);
    const cmp = compareReplays(ref.layout.outRoot, l.outRoot);
    const allowedFaultRecord = cmp.differing.filter((p) => ALLOWED.some((re) => re.test(p)));
    let differing = cmp.differing.filter((p) => !ALLOWED.some((re) => re.test(p)));
    if (d.fault === 'usage-limit-once' && d.turnId !== null) {
      // The faulted turn's `result.interruptions` is the classification itself (criterion (ii), D3a).
      const rel = path.posix.join('runs', runId, 'steps', `step-${d.turnId.slice(5, 7)}.json`);
      if (differing.includes(rel)) {
        const strip = (file: string): string => {
          const r = JSON.parse(fs.readFileSync(file, 'utf8')) as { turns: { turnId: string; result: Record<string, unknown> }[] };
          for (const t of r.turns) if (t.turnId === d.turnId) delete t.result.interruptions;
          return JSON.stringify(zeroTiming(r));
        };
        if (strip(path.join(ref.layout.outRoot, ...rel.split('/'))) === strip(path.join(l.outRoot, ...rel.split('/')))) {
          differing = differing.filter((p) => p !== rel);
          allowedFaultRecord.push(`${rel} (result.interruptions of ${d.turnId})`);
        }
      }
    }
    const a = shapes(runDirFor(ref.layout.outRoot, runId), steps);
    const b = shapes(runDir, steps);
    const shapeOk = JSON.stringify(a) === JSON.stringify(b);
    const shapeDetail = shapeOk
      ? 'same steps, turn kinds, repairs and final commits'
      : b
          .map((s, i) => (JSON.stringify(s) === JSON.stringify(a[i]) ? null : `step ${String(s.step)}: ${JSON.stringify(s)} vs reference ${JSON.stringify(a[i] ?? null)}`))
          .filter((x) => x !== null)
          .concat(b.length !== a.length ? [`${String(b.length)} step records vs ${String(a.length)}`] : [])
          .join('; ');
    const bytesIdentical = differing.length === 0;
    return {
      id: d.id,
      family: d.family,
      target: `${d.taskId}/${d.arm} (${d.shape})`,
      fault: d.fault,
      turnId: d.turnId,
      phases,
      classification,
      resumed,
      bytes: { identical: bytesIdentical, differing, allowedFaultRecord },
      shape: { ok: shapeOk, detail: shapeDetail },
      pass: classification.ok && resumed && bytesIdentical && shapeOk,
    };
  } finally {
    unmountAll(l);
    fs.rmSync(l.base, { recursive: true, force: true });
  }
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv[0] === '--child') {
    const c = JSON.parse(fs.readFileSync(argv[1] ?? '', 'utf8')) as ChildConfig;
    let res: ChildResult;
    try {
      res = await child(c);
    } catch (e) {
      res = { ok: false, errors: [{ code: 'DRILL_CHILD_THREW', message: e instanceof Error ? e.message : String(e) }] };
    }
    fs.writeFileSync(c.resultFile, JSON.stringify(res));
    return res.ok ? 0 : 1;
  }
  const only = argv.includes('--only') ? (argv[argv.indexOf('--only') + 1] ?? '').split(',') : null;
  const reportFile = argv.includes('--report') ? argv[argv.indexOf('--report') + 1] : undefined;
  const refs = new Map<string, Reference>();
  const reports: DrillReport[] = [];
  for (const d of DRILLS.filter((x) => only === null || only.includes(x.id))) {
    const t0 = Date.now();
    const r = runDrill(d, refs);
    reports.push(r);
    process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'} ${d.id} ${d.fault} ${d.turnId ?? ''} classified=${String(r.classification.ok)} resumed=${String(r.resumed)} bytes=${String(r.bytes.identical)} shape=${String(r.shape.ok)} (${String(Math.round((Date.now() - t0) / 1000))}s)\n`);
    if (!r.pass) process.stdout.write(`  ${r.classification.observed}\n  differing: ${JSON.stringify(r.bytes.differing)}\n  shape: ${r.shape.detail}\n`);
  }
  const references = [...refs.values()].map((r) => ({ key: r.key, selfIdentical: r.selfIdentical, digest: r.digest }));
  for (const r of refs.values()) fs.rmSync(r.layout.base, { recursive: true, force: true });
  const summary = {
    schema: 'loop-fault-drills/v1',
    passCriterion: PASS_CRITERION_VERSION,
    engine: 'cypher-interp',
    references,
    drills: reports,
    digest: crypto.createHash('sha256').update(JSON.stringify(reports.map((r) => [r.id, r.pass, r.bytes.differing]))).digest('hex'),
  };
  if (reportFile !== undefined) fs.writeFileSync(reportFile, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`references self-identical: ${references.map((r) => `${r.key}=${String(r.selfIdentical)}`).join(', ')}\n`);
  process.stdout.write(`${String(reports.filter((r) => r.pass).length)}/${String(reports.length)} drills pass\n`);
  return reports.every((r) => r.pass) && references.every((r) => r.selfIdentical) ? 0 : 1;
}

void main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    process.exit(2);
  },
);
