/**
 * The symbolic pipeline on the in-process Cypher interpreter, for the MCP server (v1.3 npx mode,
 * `Docs/v1.3/npx-mode.md` §3). The rules are the compiled Cypher template text, executed unchanged by
 * `MemoryGraphRepository`; nothing here restates a rule.
 *
 * Graph lifetime: the APG extractor builds a whole-project ts-morph program, so an incremental graph update is not
 * cheap; every evaluation rebuilds the graph (extract + ingest + evaluate) and reports its latency. What is cached is
 * the evaluation result, keyed by the project's source fingerprint (path, size, mtime of every source and config
 * file), the spec file (path, mtime), the scoring mode and the in-memory overrides: an unchanged project answers from
 * the cache, any file change misses it.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../pipeline/pipeline-factory.js';
import type { PipelineBundle } from '../pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../pipeline/types.js';
import type { DomainResult } from '../shared/errors/domain-result.js';
import { DomainResult as Result } from '../shared/errors/domain-result.js';
import type { EvaluationReport, ScoringMode } from '../shared/types/evaluation.js';

export interface InterpEvaluation {
  readonly report: EvaluationReport;
  /** Wall time of this call (a cache hit is the fingerprint walk only). */
  readonly latencyMs: number;
  readonly cache: 'hit' | 'miss';
}

export interface InterpEvaluateInput {
  readonly projectPath: string;
  readonly specPath: string;
  readonly scoringMode: ScoringMode;
  /** Absolute path → content (`null` = removed), applied in memory before extraction. */
  readonly overrides?: ReadonlyMap<string, string | null>;
}

export type InterpEvaluator = (input: InterpEvaluateInput) => Promise<DomainResult<InterpEvaluation>>;

/** Results kept per server (each is one report; a template check uses two: before and after). */
export const CACHE_ENTRIES = 16;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.apg-store', '.firewall']);
const FINGERPRINT_FILE_RE = /\.(?:[cm]?[jt]sx?|json)$/;

/** Hash of (relative path, size, mtime) of every source/config file under the root. Directories in SKIP_DIRS skipped. */
export function projectFingerprint(root: string): string {
  const h = createHash('sha256');
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full);
      } else if (e.isFile() && FINGERPRINT_FILE_RE.test(e.name)) {
        const st = fs.statSync(full);
        h.update(`${path.relative(root, full)}\0${String(st.size)}\0${String(st.mtimeMs)}\n`);
      }
    }
  };
  walk(root);
  return h.digest('hex');
}

function overridesKey(overrides: ReadonlyMap<string, string | null> | undefined): string {
  if (overrides === undefined || overrides.size === 0) return '';
  const h = createHash('sha256');
  for (const [p, c] of [...overrides.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    h.update(`${p}\0${c === null ? '\u0000deleted' : createHash('sha256').update(c).digest('hex')}\n`);
  }
  return h.digest('hex');
}

export interface InterpEvaluatorDeps {
  readonly makePipeline?: (config: PipelineConfig) => Pick<PipelineBundle, 'executor' | 'cleanup'>;
  readonly now?: () => number;
}

/** An evaluator with its own result cache (one per server). */
export function createInterpEvaluator(deps: InterpEvaluatorDeps = {}): InterpEvaluator {
  const makePipeline = deps.makePipeline ?? createPipeline;
  const now = deps.now ?? ((): number => performance.now());
  const cache = new Map<string, EvaluationReport>();
  // apgStorePath is only read by --persist/--diff, which this path never sets.
  const apgStorePath = path.join(os.tmpdir(), 'daedalus-mcp-apg-store');

  return async (input) => {
    const t0 = now();
    const projectPath = path.resolve(input.projectPath);
    const specPath = path.resolve(input.specPath);
    let specMtime = 0;
    try {
      specMtime = fs.statSync(specPath).mtimeMs;
    } catch {
      return Result.fail([{ code: 'SPEC_NOT_FOUND', message: `Spec file not found: ${specPath}` }]);
    }
    const key = [projectPath, projectFingerprint(projectPath), specPath, String(specMtime), input.scoringMode, overridesKey(input.overrides)].join('|');
    const hit = cache.get(key);
    if (hit !== undefined) {
      cache.delete(key);
      cache.set(key, hit); // most recently used last
      return Result.ok({ report: hit, latencyMs: Math.round(now() - t0), cache: 'hit' as const });
    }
    const config: PipelineConfig = {
      projectPath,
      specFilePath: specPath,
      neo4jUri: '',
      neo4jUser: '',
      neo4jPassword: '',
      evaluationMode: 'symbolic-only',
      pipelineMode: 'stateless',
      persist: false,
      diff: false,
      verbose: false,
      apgStorePath,
      scoringMode: input.scoringMode,
      graphEngine: 'cypher-interp',
      ...(input.overrides !== undefined && input.overrides.size > 0 && { sourceOverrides: input.overrides }),
    };
    const { executor, cleanup } = makePipeline(config);
    try {
      const result = await executor.execute();
      if (!result.success) return Result.fail(result.errors.map((e) => ({ code: e.code, message: e.message })));
      cache.set(key, result.data);
      while (cache.size > CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return Result.ok({ report: result.data, latencyMs: Math.round(now() - t0), cache: 'miss' as const });
    } catch (err) {
      return Result.fail([{ code: 'PIPELINE_FAILED', message: err instanceof Error ? err.message : String(err) }]);
    } finally {
      await cleanup();
    }
  };
}
