/**
 * The firewall and the type-check of record on a loop snapshot.
 *
 * - `firewallEvaluator`: `evaluateProject` (the `evaluate_project` pipeline, symbolic-only, v1.3 scoring FR-V6) on the
 *   work directory, mapped to a `StepEvaluation`: the v1.2E AHS, the blocking-only AHS, the v1.3 verdict, blocking and
 *   advisory counts, and the listed blocking findings (what the gate arm shows the agent). It needs a scratch Neo4j
 *   (the pipeline replaces the graph). The agent never reaches it: `evaluate_project` is denied in every arm and no
 *   Neo4j variable is in any child environment.
 * - `harnessTypechecker`: the E1 type-check of record (`<H>/bin/tsc` with the pinned per-run tsconfig, BR-U5a-48).
 *
 * The evaluator is symbolic-only, so it makes no model call and needs no cassette. A judge-mode evaluator plugged in
 * later must take the experiment's cassette directory and mode the way `run-experiment.ts` passes them (BR-U5b-56,
 * ADR-028); the plan's `cassette` block is recorded for that purpose.
 */
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { evaluateProject } from '../../../src/mcp-server/evaluate-project.js';
import type { EvaluateDeps } from '../../../src/mcp-server/evaluate-project.js';
import type { EvaluateProjectResult } from '../../../src/mcp-server/types.js';
import { templateOf } from '../../v1.3/lib/labelling/findings.js';
import { writeHarnessTsconfig } from '../generators/harness-tsconfig.js';
import { runHarnessTypecheck } from '../generators/skeleton.js';
import type { BlockingFinding, StepEvaluation, StepEvaluator, StepTypechecker } from './types.js';

const MAX_CODES = 50;

/** Maps an `evaluate_project` result (v1.3 scoring) to a step evaluation. Fails when the tiers are missing. */
export function toStepEvaluation(r: EvaluateProjectResult): DomainResult<StepEvaluation> {
  const tiers = r.tiers;
  if (tiers === undefined) {
    return DomainResult.fail([{ code: 'LOOP_EVAL_NO_TIERS', message: 'the evaluation carries no v1.3 tiers (scoringMode must be v1.3)' }]);
  }
  const blockingIds = new Set(tiers.blocking.rules.map((row) => String(row.functionId)));
  const blockingByRule: Record<string, number> = {};
  for (const row of tiers.blocking.rules) {
    if (row.violationCount > 0) blockingByRule[String(row.functionId)] = row.violationCount;
  }
  const advisoryByRule: Record<string, number> = {};
  for (const row of tiers.advisory.rules) {
    if (row.violationCount > 0) advisoryByRule[String(row.functionId)] = row.violationCount;
  }
  const blockingFindings: BlockingFinding[] = [];
  if (r.violations !== undefined) {
    // The whole report (uncapped), in rule-id order as `groupByRule` lists it, each finding with its template.
    const names = new Map(r.byRule.map((g) => [g.ruleId, g.ruleName]));
    const rows = r.violations.filter((v) => blockingIds.has(String(v.functionId)));
    const byRuleId = (a: (typeof rows)[number], b: (typeof rows)[number]): number => String(a.functionId).localeCompare(String(b.functionId));
    for (const v of [...rows].sort(byRuleId)) {
      const ruleId = String(v.functionId);
      blockingFindings.push({
        ruleId,
        ruleName: names.get(ruleId) ?? ruleId,
        template: templateOf(v.type, ruleId),
        violationId: v.id,
        filePath: v.filePath,
        ...(v.line !== undefined ? { line: v.line } : {}),
        ...(v.target !== undefined ? { target: v.target } : {}),
        message: v.message,
      });
    }
  }
  for (const group of r.violations === undefined ? r.byRule : []) {
    if (!blockingIds.has(group.ruleId)) continue;
    for (const v of group.violations) {
      blockingFindings.push({
        ruleId: group.ruleId,
        ruleName: group.ruleName,
        filePath: v.filePath,
        ...(v.line !== undefined ? { line: v.line } : {}),
        ...(v.target !== undefined ? { target: v.target } : {}),
        message: v.message,
      });
    }
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
    ...(r.violations !== undefined ? { reportViolations: r.violations } : {}),
  });
}

/**
 * Where the extractor finds the tsconfig of a snapshot. The work tree has no tsconfig of its own (the harness keeps
 * the pinned per-run tsconfig outside the cwd, BR-U5a-42), so without one `evaluate_project` fails every snapshot
 * with `TSCONFIG_NOT_FOUND`, or scores the file set of a tsconfig the agent wrote (R01, post-merge review 2026-10-16).
 */
export type SnapshotTsconfig = (projectDir: string, runId: string | undefined) => string | undefined;

/**
 * The live wiring: the pinned per-run tsconfig (`<H>/runs/<runId>/tsconfig.json`, the file `harnessTypechecker`
 * writes and the prompts' type-check command names). It is (re)written here for the snapshot's directory, so the
 * evaluation never depends on the type-check having run first.
 */
export function harnessSnapshotTsconfig(harnessRoot: string): SnapshotTsconfig {
  return (projectDir, runId) => (runId === undefined ? undefined : writeHarnessTsconfig(harnessRoot, runId, path.resolve(projectDir)));
}

export function firewallEvaluator(specPath: string, env: NodeJS.ProcessEnv, deps: EvaluateDeps, tsconfigOf?: SnapshotTsconfig): StepEvaluator {
  return {
    id: 'daedalus-evaluate-project/v1.3',
    evaluate: async (projectDir, runId) => {
      const tsconfigPath = tsconfigOf?.(projectDir, runId);
      if (tsconfigOf !== undefined && tsconfigPath === undefined) {
        return DomainResult.fail([{ code: 'LOOP_EVAL_NO_TSCONFIG', message: 'no loop run id: the pinned harness tsconfig of the snapshot cannot be named' }]);
      }
      const r = await evaluateProject({ projectPath: projectDir, specPath, scoringMode: 'v1.3', includeViolations: true, ...(tsconfigPath !== undefined ? { tsconfigPath } : {}) }, env, deps);
      return r.success ? toStepEvaluation(r.data) : DomainResult.fail(r.errors);
    },
  };
}

/** The loop's evaluator per spec file (live wiring): `firewallEvaluator` with the pinned harness tsconfig (R01). */
export function loopEvaluatorOf(harnessRoot: string, env: NodeJS.ProcessEnv, deps: EvaluateDeps): (specFile: string) => StepEvaluator {
  return (specFile) => firewallEvaluator(specFile, env, deps, harnessSnapshotTsconfig(harnessRoot));
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

