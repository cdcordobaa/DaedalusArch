/**
 * Study 2 analysis rehearsal: a SYNTHETIC loop-telemetry generator. NOT A PRE-REGISTRATION and NOT DATA
 * (Docs/v1.3/study2-analysis-rehearsal.md). Pure; no I/O (the CLI `scripts/v1.3/study2-synth.ts` writes the files).
 *
 * It produces what `scripts/lib/loop/loop.ts` writes for a grid: `schedule.json` (`loop-schedule/v1`), one `run.json`
 * (`loop-run/v1`) per run and one `steps/step-NN.json` (`loop-step/v1`) per step, typed by the harness's own
 * `RunRecord` and `StepRecord`. Nothing else of a run directory is produced (no `work/`, `snapshots.git/` or envelopes):
 * the analysis reads step records only (`study2-outline.md` §4). Every run says `dryRun: true`, model ids start with
 * `synth-` and task ids with `synth-task-`, so synthetic data cannot pass as a live grid. No sealed task is named.
 *
 * Data model: the power simulation's (`study2-power.ts`, same assumptions, same variates), per block
 * (task × model × replicate) and arm, steps s = 1..k:
 *   λ_run = exp(u_task + v_model + w_run);  b_task = slopePerStep · exp(g_task);  r_arm,task = effect_arm + e_arm,task
 *   blocking_s ~ NB(λ_run · (baseCount + b_task · (1 − r) · (s − 1)), θ)            (all zero under `floor`)
 *   advisory_s (FF-CV05 excluded) ~ NB(λ_run · (advBase + bAdv_task · (1 − spill · r) · (s − 1)) · KLOC_s, θ)
 *   FF-CV05_s ~ Poisson(0.9 · files_s)                (test-file pairing; swamps the advisory total, as in E1)
 * The gate's repair turn is generated around the final count: when the final count is positive the pre-repair count is
 * higher and the repair did not clear; when it is zero, 60 % of steps had a cleared repair. The planted effect is on the
 * step's final snapshot, which is what the harness reports as the step outcome.
 *
 * `truth` holds the generating quantities the analysis must recover: per block the expected OLS slope of each arm given
 * the latent terms (exact, the expected count is linear in s), and the planted relative reductions.
 */
import * as crypto from 'node:crypto';
import { createRng } from '../../lib/stats.js';
import type { SeededRng } from '../../lib/stats.js';
import type { GeneratorAdapterId } from '../../lib/generators/types.js';
import type { BlockingFinding, LoopArm, LoopRunSpec, RunRecord, StepEvaluation, StepRecord, TurnRecord } from '../../lib/loop/types.js';
import { loopRunId } from '../../lib/loop/plan.js';
import { count, normal, poisson, DEFAULT_ASSUMPTIONS } from './study2-power.js';
import type { PowerAssumptions } from './study2-power.js';

export const CV05_RULE = 'FF-CV05';

export type ScenarioId = 'null' | 'small' | 'expected' | 'floor';

export interface Scenario {
  readonly id: ScenarioId;
  readonly label: string;
  /** Planted relative reduction of the erosion slope (blocking, and × spillover on the advisory rules). */
  readonly effects: { readonly gate: number; readonly mcp: number };
  /** All blocking counts zero in every arm and step (the memo §5 floor). */
  readonly floor: boolean;
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'null', label: 'no effect', effects: { gate: 0, mcp: 0 }, floor: false },
  { id: 'small', label: 'small effect (gate 0.2, mcp 0.1)', effects: { gate: 0.2, mcp: 0.1 }, floor: false },
  { id: 'expected', label: 'expected effect (gate halves the slope, mcp quarters it)', effects: { gate: 0.5, mcp: 0.25 }, floor: false },
  { id: 'floor', label: 'floor: zero blocking findings everywhere; expected effect on the advisory rules', effects: { gate: 0.5, mcp: 0.25 }, floor: true },
];

export interface SynthModel {
  readonly adapterId: GeneratorAdapterId;
  readonly modelId: string;
}

export interface SynthDesign {
  readonly tasks: number;
  readonly models: readonly SynthModel[];
  readonly replicates: number;
  readonly steps: number;
  readonly arms: readonly LoopArm[];
}

const SYNTH_MODELS: readonly SynthModel[] = [
  { adapterId: 'claude-code-cli', modelId: 'synth-model-a' },
  { adapterId: 'claude-code-cli', modelId: 'synth-model-b' },
  { adapterId: 'codex-cli', modelId: 'synth-model-c' },
];

/** The outline's working grid (§6; option B of the power notes): 6 × 3 × 3, k = 5, three arms. */
export const PLANNED_DESIGN: SynthDesign = { tasks: 6, models: SYNTH_MODELS, replicates: 3, steps: 5, arms: ['none', 'daedalus-mcp', 'gate'] };

/** The pilot of the outcome memo (§2): 3 tasks × 1 model × 1 replicate, k = 4, arms none and gate. */
export const PILOT_DESIGN: SynthDesign = { tasks: 3, models: [{ adapterId: 'claude-code-cli', modelId: 'synth-pilot-model' }], replicates: 1, steps: 4, arms: ['none', 'gate'] };

export interface SynthOptions {
  readonly seed: number;
  /**
   * Adds `advisoryByRule` to every evaluation: the field PR #142 added to the harness step record (readiness gate S6;
   * #142 is merged into v1.3, so harness records now carry it). Off by default, so the committed rehearsal is unchanged.
   */
  readonly advisoryByRule?: boolean;
  /** Probability that a snapshot's evaluation fails (recorded as `evaluationError`, outcome missing). */
  readonly evalFailureRate?: number;
  readonly assumptions?: PowerAssumptions;
  /** Task id prefix (the pilot uses its own, so pilot and study ids never coincide). */
  readonly taskPrefix?: string;
}

export interface BlockTruth {
  readonly adapterId: string;
  readonly modelId: string;
  readonly taskId: string;
  readonly runIndex: number;
  /** Expected OLS slope of the blocking count per arm, given the latent terms. */
  readonly blockingSlope: Readonly<Record<string, number>>;
  /** Expected OLS slope of advisory (FF-CV05 excluded) per KLOC per arm, given the latent terms. */
  readonly advisorySlope: Readonly<Record<string, number>>;
}

export interface SynthTruth {
  readonly note: string;
  readonly scenario: Scenario;
  readonly seed: number;
  readonly design: SynthDesign;
  readonly assumptions: PowerAssumptions;
  /** Planted reduction per arm and task (effect + arm × task term, capped at 1). */
  readonly reductionByTask: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly blocks: readonly BlockTruth[];
}

export interface SynthRun {
  readonly run: RunRecord;
  readonly steps: readonly StepRecord[];
}

export interface SynthStudy {
  readonly schedule: { readonly schema: 'loop-schedule/v1'; readonly planSha256: string; readonly tasksSha256: string; readonly dryRun: true; readonly runs: readonly string[] };
  readonly runs: readonly SynthRun[];
  readonly truth: SynthTruth;
}

const sha = (algo: 'sha1' | 'sha256', s: string): string => crypto.createHash(algo).update(s).digest('hex');
const pad = (n: number): string => String(n).padStart(2, '0');
const LAYERS = ['domain', 'application', 'infrastructure', 'interfaces'] as const;
const BLOCKING_RULES = [
  { id: 'FF-L01', name: 'layer dependency direction (synthetic)' },
  { id: 'FF-S02', name: 'no dependency cycle (synthetic)' },
  { id: 'FF-P01', name: 'port boundary (synthetic)' },
] as const;

function findingAt(j: number): BlockingFinding {
  const rule = BLOCKING_RULES[j % BLOCKING_RULES.length] ?? BLOCKING_RULES[0];
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    filePath: `src/domain/m${String(j)}.ts`,
    line: 1 + (j % 7),
    target: `src/infrastructure/x${String(j)}.ts`,
    message: `synthetic blocking finding ${String(j)}`,
  };
}

/** Findings 0..n−1: an identity index persists from step to step, so index j is new at the first step with n > j. */
function findings(n: number): BlockingFinding[] {
  return Array.from({ length: n }, (_, j) => findingAt(j));
}

function byRule(fs: readonly BlockingFinding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fs) out[f.ruleId] = (out[f.ruleId] ?? 0) + 1;
  return out;
}

interface SnapshotState {
  readonly blocking: number;
  readonly advisoryOther: number;
  readonly cv05: number;
  readonly loc: number;
  readonly files: number;
}

function evaluation(st: SnapshotState, withByRule: boolean): StepEvaluation {
  const fs = findings(st.blocking);
  const advisory = st.advisoryOther + st.cv05;
  const ev: StepEvaluation = {
    scoringMode: 'v1.3',
    ahs: Math.max(0, Math.round((1 - 0.04 * st.blocking - 0.004 * advisory) * 1e6) / 1e6),
    blockingAhs: Math.max(0, Math.round((1 - 0.08 * st.blocking) * 1e6) / 1e6),
    verdict: st.blocking > 0 ? 'fail' : 'pass',
    violationCount: st.blocking + advisory,
    blockingViolationCount: st.blocking,
    advisoryViolationCount: advisory,
    blockingByRule: byRule(fs),
    blockingFindings: fs,
    durationMs: 900,
  };
  if (!withByRule) return ev;
  const adv: Record<string, number> = {};
  if (st.cv05 > 0) adv[CV05_RULE] = st.cv05;
  if (st.advisoryOther > 0) adv['FF-M01'] = st.advisoryOther;
  return { ...ev, advisoryByRule: adv } as StepEvaluation;
}

function sourceFiles(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${LAYERS[i % LAYERS.length] ?? 'domain'}/m${String(i)}.ts`).sort();
}

interface Clock {
  next(ms: number): string;
}

function clock(): Clock {
  let t = Date.parse('2026-01-01T00:00:00Z');
  return { next: (ms) => new Date((t += ms)).toISOString() };
}

function lognormal(rng: SeededRng, median: number, sd: number): number {
  return median * Math.exp(sd * normal(rng));
}

function turnRecord(
  rng: SeededRng, model: SynthModel, runId: string, turnId: string, kind: 'step' | 'repair', arm: LoopArm, st: SnapshotState, prev: SnapshotState | null,
  withByRule: boolean, evalFailureRate: number, ck: Clock,
): TurnRecord {
  const wallMs = Math.round(lognormal(rng, kind === 'step' ? 240_000 : 90_000, 0.4));
  const input = Math.round(lognormal(rng, kind === 'step' ? 60_000 : 25_000, 0.3));
  const output = Math.round(lognormal(rng, kind === 'step' ? 9_000 : 3_000, 0.4));
  const cost = model.adapterId === 'codex-cli' ? null : Math.round(lognormal(rng, kind === 'step' ? 3 : 1.2, 0.35) * 1e4) / 1e4;
  const status = rng.next() < 0.97 ? 'completed' : 'timeout';
  const failed = rng.next() < evalFailureRate;
  const added = Math.max(0, st.files - (prev?.files ?? 0));
  const tcErrors = poisson(rng, 0.15);
  return {
    turnId,
    kind,
    promptSha256: sha('sha256', `prompt:${runId}:${turnId}`),
    result: {
      status,
      usage: {
        costUsd: cost,
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: Math.round(input * 0.6),
        cacheCreationTokens: Math.round(input * 0.1),
        numTurns: 1 + poisson(rng, kind === 'step' ? 14 : 5),
        durationMs: wallMs,
      },
      wallMs,
      attempts: [{ startedAt: ck.next(1000), outcome: status }],
      interruptions: [],
      argv: model.adapterId === 'codex-cli' ? ['codex', 'exec', '<prompt>'] : ['claude', '-p', '<prompt>', '--model', model.modelId, ...(arm === 'daedalus-mcp' ? ['--mcp-config', '<mcp>'] : [])],
      envelopePath: `turns/step-${turnId.slice(5, 7)}/envelope-${turnId}.json`,
      permissionDenials: 0,
    },
    snapshot: {
      commit: sha('sha1', `commit:${runId}:${turnId}`),
      sourceFiles: sourceFiles(st.files),
      treeFileCount: st.files + 2,
      loc: st.loc,
      diff: { added, modified: Math.min(prev?.files ?? 0, 1 + poisson(rng, 2)), deleted: 0 },
      skeletonIntact: rng.next() > 0.005,
      typecheck: { errors: tcErrors, codes: Array.from({ length: Math.min(tcErrors, 50) }, () => 'TS2322') },
      evaluation: failed ? null : evaluation(st, withByRule),
      ...(failed ? { evaluationError: { code: 'EVAL_SYNTH_FAILURE', message: 'synthetic evaluator failure (missing-outcome rehearsal)' } } : {}),
    },
  };
}

/** Expected OLS slope of a + b·(s − 1) on s = 1..k is b. */
function expectedSlope(slope: number): number {
  return slope;
}

export function generateStudy(design: SynthDesign, scenario: Scenario, o: SynthOptions): SynthStudy {
  const a = o.assumptions ?? DEFAULT_ASSUMPTIONS;
  const rng = createRng(o.seed);
  const withByRule = o.advisoryByRule === true;
  const evalFailureRate = o.evalFailureRate ?? 0.01;
  const prefix = o.taskPrefix ?? 'synth-task-';
  const ck = clock();
  const arms = design.arms;
  const tasks = Array.from({ length: design.tasks }, (_, i) => ({
    id: `${prefix}${String(i + 1)}`,
    u: a.sdTask * normal(rng),
    g: a.sdSlopeTask * normal(rng),
    e: { gate: a.sdEffectTask * normal(rng), mcp: a.sdEffectTask * normal(rng) },
  }));
  const models = design.models.map((m) => ({ ...m, v: a.sdModel * normal(rng) }));
  const reduction = (arm: LoopArm, t: (typeof tasks)[number]): number =>
    arm === 'none' ? 0 : arm === 'gate' ? Math.min(1, scenario.effects.gate + t.e.gate) : Math.min(1, scenario.effects.mcp + t.e.mcp);

  const runs: SynthRun[] = [];
  const blocks: BlockTruth[] = [];
  const order: string[] = [];
  for (let r = 0; r < design.replicates; r++) {
    for (const m of models) {
      for (const t of tasks) {
        const bSlope: Record<string, number> = {};
        const aSlope: Record<string, number> = {};
        // Arms in a seeded order per block, as the harness schedules them; the order does not touch the data stream.
        const armOrder = [...arms].sort((x, y) => sha('sha1', `${String(o.seed)}:${t.id}:${String(r)}:${x}`).localeCompare(sha('sha1', `${String(o.seed)}:${t.id}:${String(r)}:${y}`)));
        for (const arm of arms) {
          const lambda = Math.exp(t.u + m.v + a.sdRun * normal(rng));
          const red = reduction(arm, t);
          const b = a.slopePerStep * Math.exp(t.g);
          const bAdv = a.advisorySlopePerKloc * Math.exp(t.g);
          const size = Math.exp(a.sdKloc * normal(rng));
          bSlope[arm] = scenario.floor ? 0 : expectedSlope(lambda * b * (1 - red));
          aSlope[arm] = expectedSlope(lambda * bAdv * (1 - red * a.advisorySpillover));
          const spec: LoopRunSpec = { adapterId: m.adapterId, modelId: m.modelId, taskId: t.id, arm, runIndex: r };
          const runId = loopRunId(spec);
          const createdAt = ck.next(5000);
          const steps: StepRecord[] = [];
          let prev: SnapshotState | null = null;
          for (let s = 1; s <= design.steps; s++) {
            const kloc = (a.kloc0 + a.klocPerStep * (s - 1)) * size;
            const loc = Math.max(1, Math.round(kloc * 1000));
            const files = Math.max(1, Math.round(loc / 35));
            const blocking = scenario.floor ? 0 : count(rng, lambda * Math.max(0, a.baseCount + b * (1 - red) * (s - 1)), a.dispersion);
            const density = lambda * Math.max(0, a.advisoryBasePerKloc + bAdv * (1 - red * a.advisorySpillover) * (s - 1));
            const final: SnapshotState = { blocking, advisoryOther: count(rng, density * (loc / 1000), a.dispersion), cv05: poisson(rng, 0.9 * files), loc, files };
            const startedAt = ck.next(1000);
            const turnId = `step-${pad(s)}`;
            const turns: TurnRecord[] = [];
            let repair: StepRecord['repair'] = null;
            if (arm === 'gate') {
              let before: SnapshotState | null = null;
              if (final.blocking > 0) before = { ...final, blocking: final.blocking + 1 + poisson(rng, 1) };
              else if (!scenario.floor && rng.next() < 0.6) before = { ...final, blocking: 1 + poisson(rng, 1) };
              if (before === null) {
                const t1 = turnRecord(rng, m, runId, turnId, 'step', arm, final, prev, withByRule, evalFailureRate, ck);
                turns.push(t1);
                repair = { attempted: false, blockingBefore: t1.snapshot.evaluation?.blockingViolationCount ?? null, blockingAfter: null, cleared: null };
              } else {
                const t1 = turnRecord(rng, m, runId, turnId, 'step', arm, before, prev, withByRule, evalFailureRate, ck);
                turns.push(t1);
                if (t1.snapshot.evaluation === null) {
                  repair = { attempted: false, blockingBefore: null, blockingAfter: null, cleared: null };
                } else {
                  const t2 = turnRecord(rng, m, runId, `${turnId}-repair`, 'repair', arm, final, before, withByRule, evalFailureRate, ck);
                  turns.push(t2);
                  const after = t2.snapshot.evaluation?.blockingViolationCount ?? null;
                  repair = { attempted: true, blockingBefore: before.blocking, blockingAfter: after, cleared: after === null ? null : after === 0 };
                }
              }
            } else {
              turns.push(turnRecord(rng, m, runId, turnId, 'step', arm, final, prev, withByRule, evalFailureRate, ck));
            }
            const last = turns[turns.length - 1];
            if (last === undefined) throw new Error('synth: a step without a turn');
            const firstEv = turns[0]?.snapshot.evaluation ?? null;
            const lastEv = last.snapshot.evaluation;
            const repairOutcome =
              repair?.attempted === true && firstEv !== null && lastEv !== null
                ? {
                    before: firstEv.blockingViolationCount,
                    shown: Math.min(firstEv.blockingViolationCount, 40),
                    removed: firstEv.blockingViolationCount - lastEv.blockingViolationCount,
                    remaining: lastEv.blockingViolationCount,
                    introduced: 0,
                    findings: firstEv.blockingFindings.map((f, j) => ({ ruleId: f.ruleId, filePath: f.filePath, ...(f.target !== undefined ? { target: f.target } : {}), shown: j < 40, removed: j >= lastEv.blockingViolationCount })),
                    introducedFindings: [],
                  }
                : undefined;
            const sum = (pick: (t: TurnRecord) => number | null): number | null => {
              const xs = turns.map(pick).filter((x): x is number => x !== null);
              return xs.length === 0 ? null : xs.reduce((x, y) => x + y, 0);
            };
            steps.push({
              schema: 'loop-step/v1',
              runId,
              spec,
              stepIndex: s - 1,
              stepId: `feature-${String(s)}`,
              startedAt,
              finishedAt: ck.next(1000),
              turns,
              repair,
              ...(repairOutcome !== undefined ? { repairOutcome } : {}),
              finalCommit: last.snapshot.commit,
              cost: {
                costUsd: sum((x) => x.result.usage.costUsd),
                inputTokens: sum((x) => x.result.usage.inputTokens),
                outputTokens: sum((x) => x.result.usage.outputTokens),
                wallMs: turns.reduce((x, y) => x + y.result.wallMs, 0),
              },
            });
            prev = final;
          }
          const run: RunRecord = {
            schema: 'loop-run/v1',
            runId,
            spec,
            steps: design.steps,
            baseCommit: sha('sha1', `base:${runId}`),
            createdAt,
            completedAt: ck.next(1000),
            dryRun: true,
          };
          runs.push({ run, steps });
        }
        for (const arm of armOrder) order.push(loopRunId({ adapterId: m.adapterId, modelId: m.modelId, taskId: t.id, arm, runIndex: r }));
        blocks.push({ adapterId: m.adapterId, modelId: m.modelId, taskId: t.id, runIndex: r, blockingSlope: bSlope, advisorySlope: aSlope });
      }
    }
  }
  const reductionByTask: Record<string, Record<string, number>> = {};
  for (const t of tasks) reductionByTask[t.id] = Object.fromEntries(arms.map((arm) => [arm, reduction(arm, t)]));
  return {
    schedule: {
      schema: 'loop-schedule/v1',
      planSha256: sha('sha256', `synthetic-plan:${scenario.id}:${String(o.seed)}`),
      tasksSha256: sha('sha256', `synthetic-tasks:${String(design.tasks)}`),
      dryRun: true,
      runs: order,
    },
    runs,
    truth: {
      note: 'SYNTHETIC. Generating quantities of a rehearsal data set (Docs/v1.3/study2-analysis-rehearsal.md); never an estimate of anything real.',
      scenario,
      seed: o.seed,
      design,
      assumptions: a,
      reductionByTask,
      blocks,
    },
  };
}
