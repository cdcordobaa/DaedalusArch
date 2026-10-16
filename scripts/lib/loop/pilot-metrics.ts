/**
 * The loop pilot's outcomes, computed from a run's step records exactly as `Docs/v1.3/pilot-outcome-memo.md` defines
 * them. Pure except `unmatchedShare`, which parses the run's spec.
 *
 * §3 primary outcome (candidates only; the memo counts a new finding only after `scripts/v1.3/check-correct.ts`
 * labels it `correct`, which the caller runs on the reports the loop writes beside each turn):
 * - blocking finding: a finding in a step's final snapshot (`steps/step-NN.json`, the last turn's `blockingFindings`);
 * - new at step s (s >= 2): no snapshot of an earlier step of the run (step and repair turns alike) holds a finding
 *   with the same identity: rule id, template, file and target, lines ignored; for a cycle (a template whose name
 *   says `cycl`), the rule id, template and the set of files.
 * §4 secondary outcomes: advisory slope per KLOC (with and without FF-CV05), gate repair success, cost and time
 * (repair turns apart), and the guards (type-check errors, skeleton integrity, files, LOC, unmatched files).
 */
import * as path from 'node:path';
import picomatch from 'picomatch';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { resolveLayer } from '../../../src/mcp-server/layer-resolver.js';
import type { BlockingFinding, StepRecord } from './types.js';

export const CV05 = 'FF-CV05';

export function findingIdentity(f: BlockingFinding): string {
  const template = f.template ?? '';
  if (/cycl/i.test(template) || /cycl/i.test(f.ruleName)) {
    const files = [...new Set([f.filePath, ...(f.target !== undefined ? [f.target] : [])])].sort();
    return JSON.stringify([f.ruleId, template, files]);
  }
  return JSON.stringify([f.ruleId, template, f.filePath, f.target ?? '']);
}

/** Ordinary least squares slope of y over x; null with fewer than two distinct x or any null y. */
export function olsSlope(points: readonly { readonly x: number; readonly y: number | null }[]): number | null {
  const pts = points.filter((p): p is { x: number; y: number } => p.y !== null);
  if (pts.length !== points.length || pts.length < 2) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx;
  return Math.round(slope * 1e9) / 1e9;
}

export interface NewBlockingStep {
  readonly step: number;
  readonly count: number;
  readonly findings: readonly BlockingFinding[];
}

export interface StepCostTime {
  readonly step: number;
  readonly stepTurn: TurnCost;
  readonly repairTurn: TurnCost | null;
  /** Usage-limit pauses and infrastructure retries of the step's turns. */
  readonly interruptions: number;
  readonly attempts: number;
}

export interface TurnCost {
  readonly costUsd: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheCreationTokens: number | null;
  readonly numTurns: number | null;
  readonly wallMs: number;
}

export interface StepGuards {
  readonly step: number;
  readonly typecheckErrors: number | null;
  readonly skeletonIntact: boolean;
  readonly files: number;
  readonly loc: number;
  readonly evaluationError: string | null;
}

export interface RunOutcomes {
  readonly runId: string;
  readonly taskId: string;
  readonly arm: string;
  /** §3: new blocking findings at steps 2..k (final snapshots). */
  readonly newBlocking: readonly NewBlockingStep[];
  readonly newBlockingTotal: number;
  /** §4 advisory findings per KLOC per step (final snapshots), and their OLS slope over the steps. */
  readonly advisoryPerKloc: readonly (number | null)[];
  readonly advisoryPerKlocWithoutCv05: readonly (number | null)[];
  readonly advisorySlopePerKloc: number | null;
  readonly advisorySlopePerKlocWithoutCv05: number | null;
  /** §4 gate repair success; null outside `gate`. */
  readonly gateRepair: {
    readonly failingSteps: readonly number[];
    readonly cleared: number;
    readonly share: number | null;
    readonly meanReduction: number | null;
    readonly introduced: number;
  } | null;
  readonly costTime: readonly StepCostTime[];
  readonly guards: readonly StepGuards[];
}

function turnCost(t: StepRecord['turns'][number] | undefined): TurnCost | null {
  if (t === undefined) return null;
  const u = t.result.usage;
  return {
    costUsd: u.costUsd,
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheReadTokens: u.cacheReadTokens,
    cacheCreationTokens: u.cacheCreationTokens,
    numTurns: u.numTurns,
    wallMs: t.result.wallMs,
  };
}

const kloc = (loc: number): number | null => (loc > 0 ? loc / 1000 : null);

/** The memo's outcomes of one run (its step records in step order). */
export function runOutcomes(steps: readonly StepRecord[]): RunOutcomes {
  const first = steps[0];
  if (first === undefined) throw new Error('runOutcomes: no step records');
  const seen = new Set<string>();
  const newBlocking: NewBlockingStep[] = [];
  const advisory: (number | null)[] = [];
  const advisoryNoCv05: (number | null)[] = [];
  const guards: StepGuards[] = [];
  const costTime: StepCostTime[] = [];
  for (const s of steps) {
    const last = s.turns[s.turns.length - 1];
    const ev = last?.snapshot.evaluation ?? null;
    if (s.stepIndex > 0) {
      const fresh: BlockingFinding[] = [];
      const ids = new Set<string>();
      for (const f of ev?.blockingFindings ?? []) {
        const id = findingIdentity(f);
        if (seen.has(id) || ids.has(id)) continue;
        ids.add(id);
        fresh.push(f);
      }
      newBlocking.push({ step: s.stepIndex + 1, count: fresh.length, findings: fresh });
    }
    for (const t of s.turns) for (const f of t.snapshot.evaluation?.blockingFindings ?? []) seen.add(findingIdentity(f));
    const k = kloc(last?.snapshot.loc ?? 0);
    const cv05 = ev?.advisoryByRule?.[CV05] ?? 0;
    advisory.push(ev === null || k === null ? null : ev.advisoryViolationCount / k);
    advisoryNoCv05.push(ev === null || k === null || ev.advisoryByRule === undefined ? null : (ev.advisoryViolationCount - cv05) / k);
    guards.push({
      step: s.stepIndex + 1,
      typecheckErrors: last?.snapshot.typecheck?.errors ?? null,
      skeletonIntact: last?.snapshot.skeletonIntact ?? false,
      files: last?.snapshot.sourceFiles.length ?? 0,
      loc: last?.snapshot.loc ?? 0,
      evaluationError: last?.snapshot.evaluationError?.code ?? null,
    });
    const stepTurn = s.turns.find((t) => t.kind === 'step');
    costTime.push({
      step: s.stepIndex + 1,
      stepTurn: turnCost(stepTurn) ?? { costUsd: null, inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null, numTurns: null, wallMs: 0 },
      repairTurn: turnCost(s.turns.find((t) => t.kind === 'repair')),
      interruptions: s.turns.reduce((a, t) => a + t.result.interruptions.length, 0),
      attempts: s.turns.reduce((a, t) => a + t.result.attempts.length, 0),
    });
  }
  const xs = steps.map((s) => s.stepIndex + 1);
  let gateRepair: RunOutcomes['gateRepair'] = null;
  if (first.spec.arm === 'gate') {
    const failing = steps.filter((s) => s.repair?.attempted === true);
    const cleared = failing.filter((s) => s.repair?.cleared === true).length;
    const reductions = failing
      .map((s) => (s.repair?.blockingBefore !== null && s.repair?.blockingAfter !== null && s.repair !== null ? s.repair.blockingBefore - s.repair.blockingAfter : null))
      .filter((v): v is number => v !== null);
    gateRepair = {
      failingSteps: failing.map((s) => s.stepIndex + 1),
      cleared,
      share: failing.length === 0 ? null : cleared / failing.length,
      meanReduction: reductions.length === 0 ? null : reductions.reduce((a, b) => a + b, 0) / reductions.length,
      introduced: failing.reduce((a, s) => a + (s.repairOutcome?.introduced ?? 0), 0),
    };
  }
  return {
    runId: first.runId,
    taskId: first.spec.taskId,
    arm: first.spec.arm,
    newBlocking,
    newBlockingTotal: newBlocking.reduce((a, s) => a + s.count, 0),
    advisoryPerKloc: advisory,
    advisoryPerKlocWithoutCv05: advisoryNoCv05,
    advisorySlopePerKloc: olsSlope(xs.map((x, i) => ({ x, y: advisory[i] ?? null }))),
    advisorySlopePerKlocWithoutCv05: olsSlope(xs.map((x, i) => ({ x, y: advisoryNoCv05[i] ?? null }))),
    gateRepair,
    costTime,
    guards,
  };
}

/**
 * §4 guard: the share of a snapshot's source files (`src/`-relative) that match no layer glob, no declared context
 * root and no `outside_contexts` glob of the spec (the last two exist for DDD only).
 */
export async function unmatchedShare(specFile: string, sourceFiles: readonly string[]): Promise<number | null> {
  if (sourceFiles.length === 0) return null;
  const parsed = await parseSpec({ specFilePath: specFile });
  if (!parsed.success) throw new Error(`${path.basename(specFile)}: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const ddd = parsed.data.layerModel.ddd;
  const outside = (ddd?.outsideContexts ?? []).map((g) => picomatch(g, { dot: true }));
  const matched = (file: string): boolean =>
    resolveLayer(parsed.data, file) !== undefined ||
    (ddd?.contexts ?? []).some((c) => file.startsWith(c.root)) ||
    outside.some((m) => m(file));
  const unmatched = sourceFiles.filter((rel) => !matched(`src/${rel}`)).length;
  return unmatched / sourceFiles.length;
}
