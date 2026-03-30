import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Project } from 'ts-morph';
import type { APGResult } from '../shared/types/apg.js';
import type { DomainResult } from '../shared/errors/domain-result.js';
import { DomainResult as DR } from '../shared/errors/domain-result.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { ExtractorOptions, ExtractorError } from './types.js';
import { DEFAULT_OPTIONS, DEFAULT_EXCLUDE_PATTERNS } from './types.js';
import { extractNodes } from './node-extractor.js';
import { extractEdges } from './edge-extractor.js';

/**
 * Standalone extraction function.
 * Orchestrates the full APG extraction pipeline for a TypeScript project.
 */
export async function extractAPG(
  projectPath: string,
  options: ExtractorOptions = {},
): Promise<DomainResult<APGResult>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const absoluteProjectPath = resolve(projectPath);

  if (!existsSync(absoluteProjectPath)) {
    return DR.fail<APGResult>([makeError('PROJECT_NOT_FOUND', `Project path not found: ${absoluteProjectPath}`)]);
  }

  const tsconfigPath = join(absoluteProjectPath, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    return DR.fail<APGResult>([makeError('TSCONFIG_NOT_FOUND', `No tsconfig.json found at: ${tsconfigPath}`)]);
  }

  try {
    // ── 1. Initialize ts-morph Project (lenient mode) ────────────────────────
    const project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: false,
      skipFileDependencyResolution: opts.lenientMode,
    });

    // ── 2. Collect source files (apply exclusion patterns) ───────────────────
    const allExcludes = [...DEFAULT_EXCLUDE_PATTERNS, ...opts.excludePatterns];
    const sourceFiles = project.getSourceFiles().filter(sf => {
      const fp = sf.getFilePath();
      return !allExcludes.some(pattern => matchGlob(pattern, fp));
    });

    if (sourceFiles.length === 0) {
      return DR.fail<APGResult>([makeError('EMPTY_PROJECT', `No .ts source files found in: ${absoluteProjectPath}`)]);
    }

    const totalFiles = sourceFiles.length;

    // ── 3. Node extraction pass ───────────────────────────────────────────────
    const { nodes, lookup, skipped } = extractNodes(sourceFiles, absoluteProjectPath, opts);

    // ── 4. Edge extraction pass ───────────────────────────────────────────────
    const { edges, warnings } = extractEdges(sourceFiles, lookup, absoluteProjectPath, opts);

    // ── 5. Parse coverage ────────────────────────────────────────────────────
    const parsedFiles = totalFiles - skipped.length;
    const percentage = totalFiles === 0
      ? 100
      : Math.round((parsedFiles / totalFiles) * 1000) / 10;

    const parseCoverage = {
      total: totalFiles,
      parsed: parsedFiles,
      percentage,
      skipped,
    };

    return DR.ok<APGResult>({ nodes, edges, parseCoverage, warnings });

  } catch (err) {
    return DR.fromError<APGResult>(err);
  }
}

/**
 * APGExtractor implements PipelineStage<string, APGResult>.
 * Integrates with FirewallContext: sets apgResult on success, logs audit entry.
 */
export class APGExtractor implements PipelineStage<string, APGResult> {
  readonly name = 'apg-extractor';

  constructor(private readonly options: ExtractorOptions = {}) {}

  async execute(projectPath: string, context: FirewallContext): Promise<DomainResult<APGResult>> {
    const startMs = Date.now();
    const result = await extractAPG(projectPath, this.options);

    if (result.success) {
      context.setApgResult(result.data);
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: this.name,
        event: 'extraction_complete',
        durationMs: Date.now() - startMs,
        metadata: {
          nodeCount: result.data.nodes.length,
          edgeCount: result.data.edges.length,
          parseCoverage: result.data.parseCoverage.percentage,
          warningCount: result.data.warnings.length,
        },
      });
    } else {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: this.name,
        event: 'extraction_failed',
        durationMs: Date.now() - startMs,
        metadata: { errors: result.errors },
      });
    }

    return result;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeError(code: ExtractorError['code'], message: string): ExtractorError {
  return { code, message, stage: 'apg-extractor', critical: true };
}

/**
 * Minimal glob matcher covering the patterns used in DEFAULT_EXCLUDE_PATTERNS.
 * Supports: **\/prefix\/** (directory), **\/*.ext (extension), exact suffix match.
 */
function matchGlob(pattern: string, filePath: string): boolean {
  // Convert glob pattern to regex
  const escaped = pattern
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]]/g, '\\$&')
    .replace(/\*\*/g, '.+')
    .replace(/\*/g, '[^/]+');
  return new RegExp(escaped).test(filePath.replace(/\\/g, '/'));
}
