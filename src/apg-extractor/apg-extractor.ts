import { existsSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { Project, ts } from 'ts-morph';
import picomatch from 'picomatch';
import type { APGResult } from '../shared/types/apg.js';
import type { DomainResult } from '../shared/errors/domain-result.js';
import { DomainResult as DR } from '../shared/errors/domain-result.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { ExtractionLimits, ExtractorOptions, ExtractorError, FileCheckpoint } from './types.js';
import { DEFAULT_OPTIONS, DEFAULT_EXCLUDE_PATTERNS } from './types.js';
import { extractNodes } from './node-extractor.js';
import { extractEdges } from './edge-extractor.js';
import { extractApg2 } from './apg2/index.js';
import { MemoryLimitError } from '../shared/process/memory-guard.js';

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
  /** Scale controls (`--max-files`, the memory guard, `--skip-excluded-sources`); absent = the extraction as before. */
  limits: ExtractionLimits = {},
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

  const guard = limits.memoryGuard;

  try {
    const allExcludes = [...DEFAULT_EXCLUDE_PATTERNS, ...opts.excludePatterns];
    const isExcluded = picomatch(allExcludes, { dot: true });
    // Match against relative path so patterns like "test/**" don't
    // accidentally match project directory names in the absolute path.
    const analysed = (filePath: string): boolean => !isExcluded(relative(absoluteProjectPath, filePath));

    // ── 0. Scale pre-flight (scale.md §6): the tsconfig's file list, counted before any file is parsed ──
    let tsconfigFiles: readonly string[] | undefined;
    if (limits.maxFiles !== undefined || limits.sourceScope === 'analysed') {
      tsconfigFiles = tsconfigFileNames(tsconfigPath);
      if (limits.maxFiles !== undefined) {
        const count = tsconfigFiles.filter((f) => !f.endsWith('.d.ts') && analysed(f)).length;
        if (count > limits.maxFiles) return DR.fail<APGResult>([tooLarge(count, limits.maxFiles, absoluteProjectPath)]);
      }
    }

    // ── 1. Initialize ts-morph Project (lenient mode) ────────────────────────
    let project: Project;
    if (limits.sourceScope === 'analysed' && tsconfigFiles !== undefined) {
      // `--skip-excluded-sources`: the analysed files and every declaration file, in the tsconfig's order.
      project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: opts.lenientMode,
      });
      const load = tsconfigFiles.filter((f) => f.endsWith('.d.ts') || analysed(f));
      load.forEach((f, i) => {
        if (guard !== undefined && i % CHECKPOINT_EVERY === 0) guard.check('source loading', `${String(i)} of ${String(load.length)} files`);
        project.addSourceFileAtPath(f);
      });
    } else {
      project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
        skipFileDependencyResolution: opts.lenientMode,
      });
    }
    guard?.check('source loading');

    // ── 2. Collect source files (apply exclusion patterns) ───────────────────
    const sourceFiles = project.getSourceFiles().filter(sf => analysed(sf.getFilePath()));

    if (sourceFiles.length === 0) {
      return DR.fail<APGResult>([makeError('EMPTY_PROJECT', `No .ts source files found in: ${absoluteProjectPath}`)]);
    }

    const totalFiles = sourceFiles.length;
    if (limits.maxFiles !== undefined && totalFiles > limits.maxFiles) {
      return DR.fail<APGResult>([tooLarge(totalFiles, limits.maxFiles, absoluteProjectPath)]);
    }
    const checkpoint = (stage: string): FileCheckpoint | undefined => guard === undefined ? undefined : (done: number, total: number): void => {
      if (done % CHECKPOINT_EVERY === 0) guard.check(stage, `${String(done)} of ${String(total)} files`);
    };

    // ── 3. Node extraction pass ───────────────────────────────────────────────
    const { nodes, lookup, skipped } = extractNodes(sourceFiles, absoluteProjectPath, opts, checkpoint('node extraction'));

    // ── 4. Edge extraction pass ───────────────────────────────────────────────
    const { edges, warnings, packageNodes, importResolution, flowsTo } = extractEdges(sourceFiles, lookup, absoluteProjectPath, opts, checkpoint('edge extraction'));
    guard?.check('edge extraction');

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
    if (err instanceof MemoryLimitError) return DR.fail<APGResult>([makeError('MEMORY_LIMIT_EXCEEDED', err.message)]);
    return DR.fromError<APGResult>(err);
  }
}

/** Memory guard checkpoint interval, in files. */
const CHECKPOINT_EVERY = 25;

/** The tsconfig's file list as ts-morph resolves it (`include`, `files`, `exclude`, `extends`), without parsing a file. */
function tsconfigFileNames(tsconfigPath: string): readonly string[] {
  const read = ts.readConfigFile(tsconfigPath, (file) => ts.sys.readFile(file));
  const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, dirname(tsconfigPath), undefined, tsconfigPath);
  return parsed.fileNames.filter((f) => ts.sys.fileExists(f));
}

function tooLarge(count: number, maxFiles: number, projectPath: string): ExtractorError {
  return makeError(
    'PROJECT_TOO_LARGE',
    `Project too large: ${String(count)} source files to analyse in ${projectPath} after the exclusions, over --max-files ${String(maxFiles)}. `
    + 'Narrow exclude_paths in the spec, point --project or --tsconfig at one package, or raise --max-files.',
  );
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

