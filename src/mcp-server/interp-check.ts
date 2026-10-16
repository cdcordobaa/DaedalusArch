/**
 * `--fast-rules-engine cypher-interp` (OFF by default; Docs/v1.3/mcp-interp-parity.md): `check_file`, `check_diff` and
 * `check_import` answer with the compiled Cypher of the spec, run by the in-process interpreter on the project's graph,
 * instead of the TypeScript re-statements of the fast path. The evaluation is the pipeline's own (`createPipeline`
 * with `graphEngine: 'cypher-interp'`, symbolic-only, v1.3 scoring), so the tool reports exactly the rules that are
 * scored. A project state (the root plus overrides) is materialised as a scratch copy and its rows are cached by the
 * content hashes of the spec and every file.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../pipeline/types.js';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import { ruleTier } from '../scoring-engine/rule-tiers.js';
import type { RuleTier } from '../scoring-engine/rule-tiers.js';
import { splitPartial } from '../scoring-engine/tiered-scoring.js';
import { blockingSummaryOf, blockingVerdictOf } from './file-check.js';
import { normalisePath } from './layer-resolver.js';
import { specRuleMeta, v13RuleStates } from './rule-meta.js';
import type { CheckImportResult, DiffCheckResult, FileCheckResult, FileViolation, RuleHit } from './types.js';

export type FastRulesEngine = 'fast' | 'cypher-interp';

export const FAST_RULES_ENGINES: readonly FastRulesEngine[] = Object.freeze(['fast', 'cypher-interp']);

export const FAST_RULES_ENGINE_ENV = 'DAEDALUS_FAST_RULES_ENGINE';

export function parseFastRulesEngine(value: string | undefined): FastRulesEngine | undefined {
  return FAST_RULES_ENGINES.find((e) => e === value);
}

/** The engine in force: the flag, else the environment, else `fast`. An unknown value counts as absent. */
export function fastRulesEngineOf(flag: string | undefined, env: NodeJS.ProcessEnv): FastRulesEngine {
  return parseFastRulesEngine(flag) ?? parseFastRulesEngine(env[FAST_RULES_ENGINE_ENV]) ?? 'fast';
}

export const NO_ROOT_NOTE = 'fast-rules-engine cypher-interp needs a project root; answered on the fast path';

/** One row of the full evaluation, project-relative. */
export interface GraphRow {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly file: string;
  readonly target?: string;
  readonly line?: number;
  readonly message: string;
  readonly severity: Violation['severity'];
  readonly type: Violation['type'];
  /** The row counts towards the v1.3 blocking verdict (status quo tiers; a partial rule's N/A rows do not). */
  readonly blocking: boolean;
}

export const rowKey = (r: { ruleId: string; file: string; target?: string | undefined }): string => `${r.ruleId}|${r.file}|${r.target ?? ''}`;

/** `next` minus `prev` as multisets on (rule, file, target). */
export function rowDelta(next: readonly GraphRow[], prev: readonly GraphRow[]): GraphRow[] {
  const before = new Map<string, number>();
  for (const r of prev) before.set(rowKey(r), (before.get(rowKey(r)) ?? 0) + 1);
  const out: GraphRow[] = [];
  for (const r of next) {
    const n = before.get(rowKey(r)) ?? 0;
    if (n > 0) before.set(rowKey(r), n - 1);
    else out.push(r);
  }
  return out;
}

/** The files a row is located in (a cycle row names several, comma-separated). */
export function rowFiles(r: GraphRow): readonly string[] {
  return r.file.split(',').map((f) => f.trim()).filter((f) => f !== '');
}

/** Blocking under the v1.3 tiers at the status quo, as `computeTieredScoring` counts it without a tier resolver. */
export function rowBlocking(v: Violation, style: string | undefined): boolean {
  const resolved = ruleTier(String(v.functionId), style);
  if (resolved.tier !== 'blocking') return false;
  const partial = resolved.entry?.partial;
  return partial === undefined || splitPartial([v], partial).counted.length === 1;
}

function relative(p: string, dir: string): string {
  let out = p.replace(/\\/g, '/');
  const root = dir.replace(/\\/g, '/').replace(/\/+$/, '');
  if (out.startsWith(`${root}/`)) out = out.slice(root.length + 1);
  return out.replace(/^\.\//, '');
}

/** The loop's ISE snapshot tsconfig (`scripts/lib/loop/specs.ts`): only import resolution reads it. */
function defaultTsconfig(hasSrc: boolean): string {
  return `${JSON.stringify({
    compilerOptions: { strict: true, target: 'ES2022', lib: ['ES2022'], module: 'commonjs', moduleResolution: 'node', esModuleInterop: true, skipLibCheck: true, noEmit: true },
    include: [hasSrc ? 'src/**/*.ts' : '**/*.ts'],
  }, null, 2)}\n`;
}

const SKIP_DIRS = new Set(['node_modules', '.git']);

/** Project-relative path to content of every file under the root (no node_modules, no .git). */
function readTree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.set(path.relative(root, abs).split(path.sep).join('/'), fs.readFileSync(abs, 'utf8'));
    }
  };
  walk(root);
  return out;
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface InterpEvaluatorOptions {
  /** States kept (least recently used out). */
  readonly cacheSize?: number;
  /** Scratch parent directory (default: the OS temp directory). */
  readonly tmpDir?: string;
}

export interface StateResult {
  readonly rows: readonly GraphRow[];
  readonly cached: boolean;
  readonly ms: number;
}

/**
 * Evaluates project states with the pipeline on the interpreter. `overrides`: project-relative path to new content,
 * or `null` for a file the state does not have.
 */
export class InterpEvaluator {
  private readonly cache = new Map<string, readonly GraphRow[]>();
  private readonly cacheSize: number;
  private readonly tmpDir: string;

  constructor(options: InterpEvaluatorOptions = {}) {
    this.cacheSize = options.cacheSize ?? 16;
    this.tmpDir = options.tmpDir ?? os.tmpdir();
  }

  async evaluate(spec: ParsedSpec, specPath: string, root: string, overrides: ReadonlyMap<string, string | null>): Promise<StateResult> {
    const t0 = performance.now();
    const absRoot = path.resolve(root);
    const tree = readTree(absRoot);
    for (const [p, c] of overrides) {
      const rel = normalisePath(p);
      if (c === null) tree.delete(rel);
      else tree.set(rel, c);
    }
    const specText = fs.readFileSync(specPath, 'utf8');
    const key = sha([sha(specText), ...[...tree.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, c]) => `${p}\0${sha(c)}`)].join('\n'));
    const hit = this.cache.get(key);
    if (hit !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return { rows: hit, cached: true, ms: performance.now() - t0 };
    }
    // A state with no TypeScript source (a first step before any file exists) has no graph and no finding.
    if (![...tree.keys()].some((k) => /\.tsx?$/.test(k) && !k.endsWith('.d.ts'))) return { rows: [], cached: false, ms: performance.now() - t0 };
    const scratch = fs.mkdtempSync(path.join(this.tmpDir, 'daedalus-interp-'));
    try {
      const dir = path.join(scratch, 'project');
      fs.mkdirSync(dir);
      for (const [rel, content] of tree) {
        const abs = path.join(dir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
      }
      if (!tree.has('tsconfig.json')) fs.writeFileSync(path.join(dir, 'tsconfig.json'), defaultTsconfig([...tree.keys()].some((k) => k.startsWith('src/'))));
      const nodeModules = path.join(absRoot, 'node_modules');
      if (fs.existsSync(nodeModules)) fs.symlinkSync(nodeModules, path.join(dir, 'node_modules'), 'dir');
      const rows = await this.run(spec, specPath, dir);
      this.cache.set(key, rows);
      while (this.cache.size > this.cacheSize) {
        const oldest = this.cache.keys().next().value;
        if (oldest === undefined) break;
        this.cache.delete(oldest);
      }
      return { rows, cached: false, ms: performance.now() - t0 };
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }

  private async run(spec: ParsedSpec, specPath: string, dir: string): Promise<readonly GraphRow[]> {
    const config: PipelineConfig = {
      projectPath: dir,
      specFilePath: specPath,
      neo4jUri: '',
      neo4jUser: '',
      neo4jPassword: '',
      graphEngine: 'cypher-interp',
      evaluationMode: 'symbolic-only',
      pipelineMode: 'stateless',
      persist: false,
      diff: false,
      verbose: false,
      apgStorePath: path.join(dir, '..', '.apg-store'),
      scoringMode: 'v1.3',
    };
    const { executor, cleanup } = createPipeline(config);
    try {
      const result = await executor.execute();
      if (!result.success) throw new Error(`cypher-interp evaluation failed: ${result.errors.map((e) => e.message).join('; ')}`);
      const names = new Map(result.data.functionResults.map((r) => [String(r.functionId), r.name]));
      return result.data.violations.map((v) => {
        const target = v.target !== undefined ? relative(v.target, dir) : undefined;
        return {
          ruleId: String(v.functionId),
          ruleName: names.get(String(v.functionId)) ?? String(v.functionId),
          file: relative(v.filePath, dir),
          ...(target !== undefined && target !== '' ? { target } : {}),
          ...(v.line !== undefined ? { line: v.line } : {}),
          message: v.message,
          severity: v.severity,
          type: v.type,
          blocking: rowBlocking(v, spec.style),
        };
      });
    } finally {
      await cleanup();
    }
  }
}

// ── Mapping graph rows to the tools' result shapes ─────────────────────────────

function toFinding(spec: ParsedSpec, r: GraphRow, preferred: string): FileViolation {
  const file = rowFiles(r).includes(preferred) ? preferred : (rowFiles(r)[0] ?? r.file);
  const meta = specRuleMeta(spec, { id: r.ruleId, name: r.ruleName });
  const tier: RuleTier = r.blocking ? 'blocking' : 'advisory';
  const line = r.line ?? 1;
  return {
    rule: r.ruleId,
    ruleName: r.ruleName,
    severity: r.severity,
    line,
    subject: r.target !== undefined ? `${r.file} -> ${r.target}` : r.file,
    reason: r.message,
    fix: `Call explain_finding with rule ${r.ruleId} and location ${file}:${String(line)} for the change that clears it.`,
    ruleId: r.ruleId,
    tier,
    tierSource: meta.tierSource,
    construct: meta.construct,
    source: meta.source,
    edgeView: meta.edgeView,
    check: 'spec',
    file,
    location: `${file}:${String(line)}`,
    ...(r.target !== undefined ? { target: r.target } : {}),
  };
}

/** Every active rule of the spec under v1.3 (what the compiled evaluation decides). */
export function interpCheckedRules(spec: ParsedSpec): readonly string[] {
  const states = v13RuleStates(spec);
  return spec.fitnessFunctions.filter((ff) => states.get(String(ff.id))?.status === 'active').map((ff) => String(ff.id));
}

/** One file's answer from graph rows, the legacy fields derived from the same rows (one verdict). */
export function fileResultFromRows(spec: ParsedSpec, base: FileCheckResult, file: string, rows: readonly GraphRow[], notes: readonly string[]): FileCheckResult & { readonly engine: 'cypher-interp' } {
  const findings = rows.map((r) => toFinding(spec, r, file)).sort((a, b) => a.line - b.line);
  const blocking = findings.filter((f) => f.tier === 'blocking');
  const blockingVerdict = blockingVerdictOf(findings, 0);
  const blockingSummary = blockingSummaryOf(blockingVerdict, findings, base.hints.length);
  return {
    ...base,
    path: file,
    verdict: blocking.length > 0 ? 'violations' : 'clean',
    summary: blockingSummary,
    violations: blocking,
    advisories: [],
    unresolved: [],
    checkedRules: interpCheckedRules(spec),
    notes: [...notes, 'answered by the compiled Cypher of the spec on the project graph (fast-rules-engine cypher-interp)'],
    findings,
    blockingVerdict,
    blockingCount: blocking.length,
    advisoryCount: findings.length - blocking.length,
    blockingSummary,
    notChecked: [],
    projectAware: true,
    engine: 'cypher-interp',
  };
}

export function diffResultFromFiles(
  files: DiffCheckResult['files'],
  skipped: DiffCheckResult['skipped'],
): DiffCheckResult & { readonly engine: 'cypher-interp' } {
  const all = files.flatMap((f) => f.findings);
  const blocking = all.filter((v) => v.tier === 'blocking');
  const blockingVerdict = blocking.length > 0 ? 'block' : 'pass';
  const hints = files.reduce((n, f) => n + f.hints.length, 0);
  const blockingSummary = blockingSummaryOf(blockingVerdict, all, hints);
  return {
    verdict: blocking.length > 0 ? 'violations' : 'clean',
    summary: blockingSummary,
    files,
    skipped,
    blockingVerdict,
    blockingCount: blocking.length,
    advisoryCount: all.length - blocking.length,
    blockingSummary,
    engine: 'cypher-interp',
  };
}

export function importResultFromRows(spec: ParsedSpec, base: CheckImportResult, rows: readonly GraphRow[], edgeSeen: boolean): CheckImportResult & { readonly engine: 'cypher-interp' } {
  const violations: RuleHit[] = rows.map((r) => {
    const meta = specRuleMeta(spec, { id: r.ruleId, name: r.ruleName });
    return {
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      severity: r.severity,
      violationType: r.type,
      reason: r.message,
      tier: r.blocking ? 'blocking' : 'advisory',
      construct: meta.construct,
      source: meta.source,
      edgeView: meta.edgeView,
    };
  });
  const blocks = rows.some((r) => r.blocking);
  const verdict = violations.length > 0 ? 'violation' : edgeSeen ? 'allowed' : 'unknown';
  return {
    ...base,
    verdict,
    violations,
    checkedRules: interpCheckedRules(spec),
    notes: [
      ...base.notes,
      'answered by the compiled Cypher of the spec on the project graph with the import written into the file (fast-rules-engine cypher-interp)',
      ...(edgeSeen ? [] : ['the extractor did not resolve the specifier to a project file or package, so no edge was added: the answer is unknown']),
    ],
    blockingVerdict: blocks ? 'block' : verdict === 'unknown' ? 'unknown' : 'pass',
    engine: 'cypher-interp',
  };
}
