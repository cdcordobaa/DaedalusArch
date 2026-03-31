import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createPipeline } from '../pipeline/pipeline-factory.js';
import type { BatchOptions, BatchRow, BatchResult, PipelineConfig } from '../pipeline/types.js';
import type { EvaluationMode } from '../shared/types/enums.js';

/**
 * Discover TypeScript projects inside a directory.
 * A subdirectory is treated as a project if it contains tsconfig.json or package.json.
 */
export function discoverProjects(dir: string): string[] {
  const absDir = resolve(dir);
  if (!existsSync(absDir)) {
    throw new Error(`Directory not found: ${absDir}`);
  }

  const entries = readdirSync(absDir, { withFileTypes: true });
  const projects: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectPath = join(absDir, entry.name);
    // A directory counts as a project when it has a tsconfig or package manifest
    if (
      existsSync(join(projectPath, 'tsconfig.json')) ||
      existsSync(join(projectPath, 'package.json'))
    ) {
      projects.push(projectPath);
    }
  }

  // Alphabetical sort for deterministic ordering
  return projects.sort();
}

/**
 * Build the PipelineConfig for a single project within a batch.
 */
function buildConfig(
  projectPath: string,
  opts: BatchOptions,
  evaluationMode: EvaluationMode,
): PipelineConfig {
  return {
    projectPath,
    specFilePath: opts.spec,
    neo4jUri: opts.neo4jUri,
    neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
    neo4jPassword: process.env['NEO4J_PASSWORD'] ?? 'neo4j',
    evaluationMode,
    pipelineMode: 'stateless',
    persist: false,
    diff: false,
    verbose: opts.verbose,
    apgStorePath: process.env['APG_STORE_PATH'] ?? '.apg-store',
    llmConfig: evaluationMode !== 'symbolic-only'
      ? {
          provider: (process.env['LLM_PROVIDER'] as 'claude' | 'openai' | undefined) ?? 'claude',
          apiKey: process.env['ANTHROPIC_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '',
        }
      : undefined,
  };
}

/**
 * Evaluate a single project within a batch, returning a BatchRow.
 */
async function evaluateProject(
  projectPath: string,
  opts: BatchOptions,
  evaluationMode: EvaluationMode,
): Promise<BatchRow> {
  const start = Date.now();
  const config = buildConfig(projectPath, opts, evaluationMode);
  const { executor, cleanup } = createPipeline(config);

  try {
    const result = await executor.execute();
    const durationMs = Date.now() - start;

    if (result.success) {
      const report = result.data;
      return {
        projectPath,
        ahsDeterministic: Number(report.ahsDeterministic),
        ahsCombined: report.ahsCombined != null ? Number(report.ahsCombined) : null,
        verdict: report.verdict,
        violationCount: report.violations.length,
        durationMs,
      };
    }

    return {
      projectPath,
      ahsDeterministic: 0,
      ahsCombined: null,
      verdict: 'ERROR',
      violationCount: 0,
      durationMs,
      error: result.errors.map((e) => e.message).join('; '),
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      projectPath,
      ahsDeterministic: 0,
      ahsCombined: null,
      verdict: 'ERROR',
      violationCount: 0,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await cleanup();
  }
}

/**
 * Format a BatchRow as a CSV line.
 */
function formatBatchCSVRow(row: BatchRow): string {
  const combined = row.ahsCombined != null ? row.ahsCombined.toFixed(4) : '';
  const errorField = row.error != null ? row.error.replaceAll(',', ';') : '';
  return `${row.projectPath},${row.ahsDeterministic.toFixed(4)},${combined},${row.verdict},${String(row.violationCount)},${String(row.durationMs)},${errorField}`;
}

/**
 * Run batch evaluation across all discovered projects.
 *
 * @returns exit code: 0 = all pass/warning, 1 = violations found, 2 = errors
 */
export async function runBatch(
  opts: BatchOptions,
  evaluationMode: EvaluationMode,
): Promise<number> {
  const projects = discoverProjects(opts.dir);

  if (projects.length === 0) {
    process.stderr.write(`No projects found in ${opts.dir}\n`);
    return 2;
  }

  if (opts.verbose) {
    process.stderr.write(`Found ${String(projects.length)} projects in ${opts.dir}\n`);
  }

  const rows: BatchRow[] = [];
  const batchStart = Date.now();

  for (const projectPath of projects) {
    if (opts.verbose) {
      process.stderr.write(`\nEvaluating: ${projectPath}...\n`);
    }

    const row = await evaluateProject(projectPath, opts, evaluationMode);
    rows.push(row);

    if (opts.verbose) {
      const symbol = row.verdict === 'ERROR' ? 'x' : row.verdict === 'pass' ? 'v' : '!';
      process.stderr.write(`  [${symbol}] ${row.verdict} (${String(row.durationMs)}ms)\n`);
    }
  }

  const totalDurationMs = Date.now() - batchStart;
  const passCount = rows.filter((r) => r.verdict === 'pass' || r.verdict === 'warning').length;
  const failCount = rows.filter((r) => r.verdict === 'soft-block' || r.verdict === 'hard-block').length;
  const errorCount = rows.filter((r) => r.verdict === 'ERROR').length;

  // Output results — machine-readable to stdout
  if (opts.format === 'csv') {
    process.stdout.write('project,ahs_deterministic,ahs_combined,verdict,violations,duration_ms,error\n');
    for (const row of rows) {
      process.stdout.write(formatBatchCSVRow(row) + '\n');
    }
  } else {
    const batchResult: BatchResult = {
      rows,
      totalProjects: projects.length,
      passCount,
      failCount,
      errorCount,
      totalDurationMs,
    };
    process.stdout.write(JSON.stringify(batchResult, null, 2) + '\n');
  }

  // Summary to stderr (human-facing)
  process.stderr.write(
    `\nBatch complete: ${String(passCount)} pass, ${String(failCount)} fail, ${String(errorCount)} error (${String(totalDurationMs)}ms)\n`,
  );

  // Exit code: highest severity
  if (errorCount > 0) return 2;
  if (failCount > 0) return 1;
  return 0;
}
