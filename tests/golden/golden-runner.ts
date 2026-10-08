/**
 * Runs one golden case through the real pipeline, built exactly as the CLI
 * builds it (src/cli/cli.ts evaluate action), and returns the data the
 * snapshot needs (D-U0-12). No credential fallback: the caller passes them.
 *
 * Collapsed onto the assembled report (U3-R9, BR-U3-62): the run carries the
 * `EvaluationReport` that `executor.execute()` returns (written by
 * `AssembleReportCommand`) and the context warnings; it never reads the
 * evaluation results or the compiled functions from the context.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineBundle } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { PipelineWarning } from '../../src/shared/errors/domain-result.js';
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import type { GoldenCase } from './golden-cases.js';
import type { GoldenNeo4jConfig } from './golden-env.js';

export interface GoldenRun {
  /** The assembled report (`executor.execute()`, BR-U3-50). */
  readonly report: EvaluationReport;
  /** `FirewallContext.warnings`: equal to `report.warnings` before scrub, sort and cap (BR-U3-62). */
  readonly warnings: readonly PipelineWarning[];
}

/**
 * Every path returns a `DomainResult` (never rejects). The temp `apgStorePath`
 * is always removed, also when `createPipeline` or `bundle.cleanup()` throws.
 */
export async function runGoldenCase(
  c: GoldenCase,
  neo4j: GoldenNeo4jConfig,
): Promise<DomainResult<GoldenRun>> {
  let apgStorePath: string | undefined;
  try {
    apgStorePath = fs.mkdtempSync(path.join(os.tmpdir(), `golden-apg-${c.id}-`));

    const config: PipelineConfig = {
      projectPath: c.projectPath,
      specFilePath: c.specPath,
      neo4jUri: neo4j.uri,
      neo4jUser: neo4j.user,
      neo4jPassword: neo4j.password,
      evaluationMode: 'symbolic-only',
      pipelineMode: 'stateless',
      persist: false,
      diff: false,
      verbose: false,
      apgStorePath,
      llmConfig: undefined,
    };

    const bundle = createPipeline(config);
    let outcome: DomainResult<GoldenRun>;
    try {
      outcome = await executeBundle(bundle);
    } catch (e) {
      outcome = DomainResult.fromError<GoldenRun>(e);
    }
    try {
      await bundle.cleanup();
    } catch (e) {
      // A cleanup failure is reported, but never hides the run's own errors.
      const cleanupError = DomainResult.fromError<GoldenRun>(e);
      const cleanupErrors = cleanupError.success ? [] : cleanupError.errors;
      outcome = outcome.success
        ? DomainResult.fail<GoldenRun>(cleanupErrors)
        : DomainResult.fail<GoldenRun>([...outcome.errors, ...cleanupErrors]);
    }
    return outcome;
  } catch (e) {
    return DomainResult.fromError<GoldenRun>(e);
  } finally {
    if (apgStorePath !== undefined) {
      fs.rmSync(apgStorePath, { recursive: true, force: true });
    }
  }
}

async function executeBundle(bundle: PipelineBundle): Promise<DomainResult<GoldenRun>> {
  const result = await bundle.executor.execute();
  if (!result.success) {
    return DomainResult.fail<GoldenRun>(result.errors);
  }
  return DomainResult.ok<GoldenRun>({
    report: result.data,
    warnings: [...bundle.context.warnings],
  });
}
