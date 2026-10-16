/**
 * The firewall and the type-check of record on a loop snapshot.
 *
 * - `firewallEvaluator`: `evaluateProject` (the `evaluate_project` pipeline, symbolic-only, v1.3 scoring FR-V6) on the
 *   work directory, mapped to a `StepEvaluation`: the v1.2E AHS, the blocking-only AHS, the v1.3 verdict, blocking and
 *   advisory counts, and the listed blocking findings (what the gate arm shows the agent). On Neo4j it needs a
 *   scratch database (the pipeline replaces the graph); `engine-tee.ts` records the engine. The agent never reaches
 *   it: `evaluate_project` is denied in every arm and no Neo4j variable is in any child environment.
 * - `harnessTypechecker`: the E1 type-check of record (`<H>/bin/tsc` with the pinned per-run tsconfig, BR-U5a-48).
 *
 * The evaluator is symbolic-only, so it makes no model call and needs no cassette. A judge-mode evaluator plugged in
 * later must take the experiment's cassette directory and mode the way `run-experiment.ts` passes them (BR-U5b-56,
 * ADR-028); the plan's `cassette` block is recorded for that purpose.
 */
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { evaluateProject } from '../../../src/mcp-server/evaluate-project.js';
import type { EvaluateDeps } from '../../../src/mcp-server/evaluate-project.js';
import type { EvaluateProjectResult } from '../../../src/mcp-server/types.js';
import { CONSTRUCT_ANSWERS } from '../../../src/shared/construct-switches.js';
import { constructSwitchesActive } from '../../../src/construct-switches/compile.js';
import { constructTierResolver } from '../../../src/construct-switches/pipeline.js';
import { countedTierOf } from '../../../src/scoring-engine/tiered-scoring.js';
import type { TierResolver } from '../../../src/scoring-engine/tiered-scoring.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { templateOf } from '../../v1.3/lib/labelling/findings.js';
import { harnessTsconfigPath } from '../generators/argv.js';
import { writeHarnessTsconfig } from '../generators/harness-tsconfig.js';
import { runHarnessTypecheck } from '../generators/skeleton.js';
import type { BlockingFinding, StepEvaluation, StepEvaluator, StepTypechecker } from './types.js';

const MAX_CODES = 50;

/**
 * Maps an `evaluate_project` result (v1.3 scoring) to a step evaluation. Fails when the tiers or the report's
 * violations are missing.
 *
 * The blocking findings are the rows the v1.3 scoring counts as blocking, placed row by row exactly as
 * `computeTieredScoring` places them (`countedTierOf`): the N/A part of FF-P06 (FLOWS_TO and HOLDS_STATE_OF rows) and
 * rows a construct switch moves to another tier are left out. Their number must equal `blockingViolationCount`, else
 * the mapping fails with `LOOP_EVAL_FINDINGS_MISMATCH`: the gate's repair prompt, the repair outcome and the pilot
 * outcomes all read this list, so a finding the scoring does not count must never reach them.
 *
 * `resolver` is the switch-aware tier lookup the pipeline used (`constructTierResolver`); absent at the status quo.
 */
export function toStepEvaluation(r: EvaluateProjectResult, resolver?: TierResolver): DomainResult<StepEvaluation> {
  const tiers = r.tiers;
  if (tiers === undefined) {
    return DomainResult.fail([{ code: 'LOOP_EVAL_NO_TIERS', message: 'the evaluation carries no v1.3 tiers (scoringMode must be v1.3)' }]);
  }
  if (r.violations === undefined) {
    return DomainResult.fail([{ code: 'LOOP_EVAL_NO_VIOLATIONS', message: 'the evaluation carries no report violations (includeViolations must be set)' }]);
  }
  const blockingByRule: Record<string, number> = {};
  for (const row of tiers.blocking.rules) {
    if (row.violationCount > 0) blockingByRule[String(row.functionId)] = (blockingByRule[String(row.functionId)] ?? 0) + row.violationCount;
  }
  const advisoryByRule: Record<string, number> = {};
  for (const row of tiers.advisory.rules) {
    if (row.violationCount > 0) advisoryByRule[String(row.functionId)] = (advisoryByRule[String(row.functionId)] ?? 0) + row.violationCount;
  }
  // The whole report (uncapped), in rule-id order as `groupByRule` lists it, each finding with its template.
  const style = tiers.style ?? undefined;
  const names = new Map(r.byRule.map((g) => [g.ruleId, g.ruleName]));
  const rows = r.violations.filter((v) => countedTierOf(v, style, resolver) === 'blocking');
  const byRuleId = (a: (typeof rows)[number], b: (typeof rows)[number]): number => String(a.functionId).localeCompare(String(b.functionId));
  const blockingFindings: BlockingFinding[] = [...rows].sort(byRuleId).map((v) => {
    const ruleId = String(v.functionId);
    return {
      ruleId,
      ruleName: names.get(ruleId) ?? ruleId,
      template: templateOf(v.type, ruleId),
      violationId: v.id,
      filePath: v.filePath,
      ...(v.line !== undefined ? { line: v.line } : {}),
      ...(v.target !== undefined ? { target: v.target } : {}),
      message: v.message,
    };
  });
  if (blockingFindings.length !== tiers.blocking.violationCount) {
    return DomainResult.fail([{
      code: 'LOOP_EVAL_FINDINGS_MISMATCH',
      message: `${String(blockingFindings.length)} blocking report rows, but the v1.3 tiers count ${String(tiers.blocking.violationCount)}`,
    }]);
  }
  return DomainResult.ok({
    scoringMode: 'v1.3',
    ahs: r.ahs,
    blockingAhs: tiers.blockingAhs,
    verdict: tiers.verdict,
    violationCount: r.violationCount,
    blockingViolationCount: tiers.blocking.violationCount,
    advisoryViolationCount: tiers.advisory.violationCount,
    blockingByRule,
    advisoryByRule,
    blockingFindings,
    durationMs: r.durationMs,
    reportViolations: r.violations,
  });
}

/** The tier lookup the pipeline uses for a spec (`constructTierResolver`); undefined at the status quo. */
async function specTierResolver(specPath: string): Promise<DomainResult<TierResolver | undefined>> {
  if (!constructSwitchesActive(CONSTRUCT_ANSWERS)) return DomainResult.ok(undefined);
  const spec = await parseSpec({ specFilePath: specPath });
  if (!spec.success) return DomainResult.fail(spec.errors);
  return DomainResult.ok(constructTierResolver(CONSTRUCT_ANSWERS, spec.data.style, spec.data.layerModel));
}

/**
 * Where the extractor finds the tsconfig of a snapshot. The work tree has no tsconfig of its own (the harness keeps
 * the pinned per-run tsconfig outside the cwd, BR-U5a-42), so without one `evaluate_project` fails every snapshot
 * with `TSCONFIG_NOT_FOUND` (found by the loop replay, `Docs/v1.3/loop-replay.md`).
 */
export type SnapshotTsconfig = (projectDir: string, runId: string | undefined) => string | undefined;

/** The live wiring: the per-run tsconfig `harnessTypechecker` writes before every evaluation (same file, same run). */
export function harnessSnapshotTsconfig(harnessRoot: string): SnapshotTsconfig {
  return (_projectDir, runId) => (runId === undefined ? undefined : harnessTsconfigPath(harnessRoot, runId));
}

export function firewallEvaluator(specPath: string, env: NodeJS.ProcessEnv, deps: EvaluateDeps, tsconfigOf?: SnapshotTsconfig): StepEvaluator {
  return {
    id: 'daedalus-evaluate-project/v1.3',
    evaluate: async (projectDir, runId) => {
      const tsconfigPath = tsconfigOf?.(projectDir, runId);
      const r = await evaluateProject({ projectPath: projectDir, specPath, scoringMode: 'v1.3', includeViolations: true, ...(tsconfigPath !== undefined ? { tsconfigPath } : {}) }, env, deps);
      if (!r.success) return DomainResult.fail(r.errors);
      const resolver = await specTierResolver(specPath);
      if (!resolver.success) return DomainResult.fail(resolver.errors);
      return toStepEvaluation(r.data, resolver.data);
    },
  };
}

export function harnessTypechecker(runner: ProcessRunner, harnessRoot: string): StepTypechecker {
  return {
    typecheck: async (runId, cwd) => {
      writeHarnessTsconfig(harnessRoot, runId, cwd);
      const r = await runHarnessTypecheck(runner, harnessRoot, runId, cwd);
      if (!r.success) return DomainResult.fail(r.errors);
      return DomainResult.ok({ errors: r.data.length, codes: r.data.slice(0, MAX_CODES) });
    },
  };
}
