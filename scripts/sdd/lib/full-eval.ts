/**
 * The full symbolic evaluation of the demo project on the in-process engine (`cypher-interp`,
 * Docs/v1.3/cypher-interpreter.md): extractor, ingestion into the in-memory graph, the compiled Cypher templates, v1.3
 * tiered scoring. No Neo4j, no LLM (symbolic-only). The result is reduced to what the demo compares: the v1.3 verdict
 * and the blocking findings as (rule, file, target).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import type { FullFindingKey } from './transcript.js';

export interface FullEvalSummary {
  readonly verdict: 'pass' | 'fail';
  readonly blocking: readonly FullFindingKey[];
  readonly advisoryCount: number;
  readonly advisoryRules: readonly string[];
  /** Advisory findings as (rule, file, target), metrics excluded (FF-C03, FF-C06 and FF-CV05 fire on most files). */
  readonly advisory: readonly FullFindingKey[];
  readonly durationMs: number;
}

/** Advisory rules whose rows are left out of `advisory` (still counted in `advisoryCount`). */
export const NOISY_ADVISORY = Object.freeze(['FF-C03', 'FF-C06', 'FF-CV05']);

function rel(root: string, p: string | undefined): string {
  if (p === undefined || p === '') return '';
  const abs = path.isAbsolute(p) ? p : path.join(root, p);
  const r = path.relative(root, abs);
  return r.startsWith('..') ? p : r.split(path.sep).join('/');
}

export function summarise(report: EvaluationReport, root: string, durationMs: number): FullEvalSummary {
  const tiers = report.tiers;
  if (tiers === undefined) throw new Error('the report has no v1.3 tiers (scoringMode must be v1.3)');
  const blockingIds = new Set(tiers.blocking.rules.filter((r) => r.violated).map((r) => String(r.functionId)));
  const advisoryIds = tiers.advisory.rules.filter((r) => r.violated).map((r) => String(r.functionId));
  const keysOf = (ids: ReadonlySet<string>): FullFindingKey[] => {
    const keys = report.violations
      .filter((v) => ids.has(String(v.functionId)))
      .map((v) => ({ ruleId: String(v.functionId), file: rel(root, v.filePath), target: rel(root, v.target) }));
    return [...new Map(keys.map((k) => [`${k.ruleId}|${k.file}|${k.target}`, k])).values()].sort((a, b) =>
      `${a.ruleId}|${a.file}|${a.target}`.localeCompare(`${b.ruleId}|${b.file}|${b.target}`),
    );
  };
  return {
    verdict: tiers.verdict,
    blocking: keysOf(blockingIds),
    advisoryCount: tiers.advisory.violationCount,
    advisoryRules: [...advisoryIds].sort(),
    advisory: keysOf(new Set(advisoryIds.filter((id) => !NOISY_ADVISORY.includes(id)))),
    durationMs,
  };
}

/** Evaluate `projectDir` against `specPath` in process. */
export async function fullEvaluate(projectDir: string, specPath: string): Promise<FullEvalSummary> {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-full-eval-'));
  try {
    const config: PipelineConfig = {
      projectPath: projectDir,
      specFilePath: specPath,
      neo4jUri: '',
      neo4jUser: '',
      neo4jPassword: '',
      evaluationMode: 'symbolic-only',
      pipelineMode: 'stateless',
      persist: false,
      diff: false,
      verbose: false,
      apgStorePath: path.join(work, '.apg-store'),
      scoringMode: 'v1.3',
      graphEngine: 'cypher-interp',
    };
    const { executor, cleanup } = createPipeline(config);
    const t0 = performance.now();
    try {
      const res = await executor.execute();
      if (!res.success) throw new Error(res.errors.map((e) => e.message).join('; '));
      return summarise(res.data, path.resolve(projectDir), performance.now() - t0);
    } finally {
      await cleanup();
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
