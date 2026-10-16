import { existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { Project } from 'ts-morph';
import picomatch from 'picomatch';
import type { APGResult } from '../shared/types/apg.js';
import type { DomainResult } from '../shared/errors/domain-result.js';
import { DomainResult as DR } from '../shared/errors/domain-result.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { ExtractorOptions, ExtractorError } from './types.js';
import { DEFAULT_OPTIONS, DEFAULT_EXCLUDE_PATTERNS } from './types.js';
import { extractNodes } from './node-extractor.js';
import { extractEdges } from './edge-extractor.js';
import { extractApg2 } from './apg2/index.js';

/**
 * Standalone extraction function.
 * Orchestrates the full APG extraction pipeline for a TypeScript project.
 */
export async function extractAPG(
  projectPath: string,
  options: ExtractorOptions = {},
  /**
   * ADR-032: an explicit tsconfig file. When given it is the only tsconfig read, and the project's own
   * `tsconfig.json` (if any) is ignored. E1 cells pass the pinned per-run tsconfig of `Docs/generator-protocol.md` §3.
   */
  tsconfigOverride?: string,
  /**
   * v1.3 npx mode (MCP `check_file`/`check_diff` with `templates`): in-memory content per absolute file path, applied
   * to the ts-morph project before extraction (`null` removes the file). Nothing is written to disk. Absent (every
   * CLI and study path) = the files on disk, unchanged.
   */
  sourceOverrides?: ReadonlyMap<string, string | null>,
): Promise<DomainResult<APGResult>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const absoluteProjectPath = resolve(projectPath);

  if (!existsSync(absoluteProjectPath)) {
    return DR.fail<APGResult>([makeError('PROJECT_NOT_FOUND', `Project path not found: ${absoluteProjectPath}`)]);
  }

  const tsconfigPath = tsconfigOverride !== undefined ? resolve(tsconfigOverride) : join(absoluteProjectPath, 'tsconfig.json');
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

    // In-memory edits (MCP template checks); never saved.
    for (const [filePath, content] of sourceOverrides ?? []) {
      if (content === null) {
        const sf = project.getSourceFile(filePath);
        if (sf !== undefined) project.removeSourceFile(sf);
      } else {
        project.createSourceFile(filePath, content, { overwrite: true });
      }
    }

    // ── 2. Collect source files (apply exclusion patterns) ───────────────────
    const allExcludes = [...DEFAULT_EXCLUDE_PATTERNS, ...opts.excludePatterns];
    const isExcluded = picomatch(allExcludes, { dot: true });
    const sourceFiles = project.getSourceFiles().filter(sf => {
      // Match against relative path so patterns like "test/**" don't
      // accidentally match project directory names in the absolute path.
      const relPath = relative(absoluteProjectPath, sf.getFilePath());
      return !isExcluded(relPath);
    });

    if (sourceFiles.length === 0) {
      return DR.fail<APGResult>([makeError('EMPTY_PROJECT', `No .ts source files found in: ${absoluteProjectPath}`)]);
    }

    const totalFiles = sourceFiles.length;

    // ── 3. Node extraction pass ───────────────────────────────────────────────
    const { nodes, lookup, skipped } = extractNodes(sourceFiles, absoluteProjectPath, opts);

    // ── 4. Edge extraction pass ───────────────────────────────────────────────
    const { edges, warnings, packageNodes, importResolution, flowsTo } = extractEdges(sourceFiles, lookup, absoluteProjectPath, opts);

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

    // Extracted nodes first (unchanged order), then Package nodes by name (domain-entities.md §2.6).
    // No warnings argument: extractor warnings stay in APGResult.warnings (BR-U2-26, Q15 A).
    const v13Nodes = [...nodes, ...packageNodes];
    // APG v2 (`apg2` option, OFF in the v1.2E and v1.3 defaults): appended after every v1.3 node and edge, so the
    // v1.3 part of the result is the same with the option on or off.
    if (opts.apg2) {
      const v2 = extractApg2(sourceFiles, lookup, absoluteProjectPath, v13Nodes, edges, opts.components);
      return DR.ok<APGResult>({
        nodes: [...v13Nodes, ...v2.nodes], edges: [...edges, ...v2.edges], parseCoverage, warnings, importResolution, flowsTo, apg2: v2.stats,
      });
    }
    return DR.ok<APGResult>({ nodes: v13Nodes, edges, parseCoverage, warnings, importResolution, flowsTo });

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

