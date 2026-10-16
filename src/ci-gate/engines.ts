/**
 * The engines the gate evaluates one commit with. Both return the commit's findings with their v1.3 tier and a fix
 * hint.
 *
 * - `neo4j`: the symbolic-only pipeline `evaluate --symbolic-only` runs (every compiled Cypher rule, v1.3 tiers), on
 *   a Neo4j instance. The pipeline clears the database before each ingestion, so it needs a scratch instance.
 *   Fix hints: `check_file`'s concrete fix where the lexical scan reports the same rule + file + target, else the
 *   report catalogue's (`formatActionableViolation`, the text `report` prints).
 * - `lexical`: in-process, no database. Every source file of the commit goes through `check_file`'s rules
 *   (`checkSource`, the MCP server's lexical scan): the import rules FF-S01, FF-S03, FF-S04, FF-P01 and the naming
 *   rules. It does not see rules that need the graph (cycles, injection, implements, held state, DDD rules).
 *   Fix hints: `check_file`'s concrete fix per violation.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import type { EvaluationReport, ScoringMode } from '../shared/types/evaluation.js';
import type { PipelineConfig } from '../pipeline/types.js';
import type { PipelineBundle } from '../pipeline/pipeline-factory.js';
import { ruleTier } from '../scoring-engine/rule-tiers.js';
import { INSTRUMENT_VERSION } from '../fitness-compiler/role-exemptions.js';
import { splitPartial } from '../scoring-engine/tiered-scoring.js';
import { formatActionableViolation } from '../report/actionable-formatter.js';
import { checkSource } from '../mcp-server/file-check.js';
import { normalisePath } from '../mcp-server/layer-resolver.js';
import { findingKey } from './match.js';
import type { GateEngineName, GateFinding, GateTier } from './types.js';

export interface EngineInput {
  /** Directory of the project inside the exported commit. */
  readonly projectDir: string;
  /** Spec file on disk (from the base commit by default). */
  readonly specPath: string;
  readonly spec: ParsedSpec;
}

export interface GateEngine {
  readonly name: GateEngineName;
  readonly evaluate: (input: EngineInput) => Promise<readonly GateFinding[]>;
}

/** The v1.3 tier of a rule row; FF-P06 rows of its N/A part are `not-applicable`. */
export function tierOf(v: Violation, style: string | undefined): GateTier {
  const resolved = ruleTier(String(v.functionId), style);
  const partial = resolved.entry?.partial;
  if (partial !== undefined && splitPartial([v], partial).na.length > 0) return 'not-applicable';
  return resolved.tier;
}

/** A tool path in project-relative form (comma lists, as cycle rows carry, are normalised part by part). */
export function relativeToProject(p: string, projectDir: string): string {
  const root = projectDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return p
    .split(',')
    .map((part) => {
      let out = part.trim().replace(/\\/g, '/');
      if (out.startsWith(root + '/')) out = out.slice(root.length + 1);
      return out.replace(/^\.\//, '');
    })
    .join(',');
}

/** Gate findings of a pipeline report. Pure. */
export function findingsFromReport(report: EvaluationReport, spec: ParsedSpec, projectDir: string): GateFinding[] {
  const names = new Map(spec.fitnessFunctions.map((f) => [String(f.id), f.name]));
  const style = report.tiers?.style ?? spec.style;
  return report.violations.map((v) => {
    const fix = formatActionableViolation(v, spec.fitnessFunctions).fix;
    const target = v.target !== undefined && v.target !== '' ? relativeToProject(v.target, projectDir) : undefined;
    return {
      ruleId: String(v.functionId),
      ruleName: names.get(String(v.functionId)) ?? String(v.functionId),
      tier: tierOf(v, style),
      file: relativeToProject(v.filePath, projectDir),
      ...(target !== undefined ? { target } : {}),
      ...(v.line !== undefined ? { line: v.line } : {}),
      message: v.message,
      ...(fix !== '' ? { fix } : {}),
    };
  });
}

export interface Neo4jEngineOptions {
  readonly neo4jUri: string;
  readonly neo4jUser: string;
  readonly neo4jPassword: string;
  readonly apgStorePath: string;
  readonly scoringMode?: ScoringMode;
  readonly verbose?: boolean;
  /** Injected for tests; production uses `createPipeline`. */
  readonly makePipeline: (config: PipelineConfig) => Pick<PipelineBundle, 'executor' | 'cleanup'>;
}

/** The `evaluate --symbolic-only` pipeline, configured as the `evaluate` command's defaults configure it. */
export function neo4jEngine(opts: Neo4jEngineOptions): GateEngine {
  return {
    name: 'neo4j',
    evaluate: async ({ projectDir, specPath, spec }) => {
      const config: PipelineConfig = {
        projectPath: projectDir,
        specFilePath: specPath,
        neo4jUri: opts.neo4jUri,
        neo4jUser: opts.neo4jUser,
        neo4jPassword: opts.neo4jPassword,
        evaluationMode: 'symbolic-only',
        pipelineMode: 'stateless',
        persist: false,
        diff: false,
        verbose: opts.verbose ?? false,
        apgStorePath: opts.apgStorePath,
        instrumentVersion: INSTRUMENT_VERSION,
        neuralAggregation: 'registered',
        scoringMode: opts.scoringMode ?? 'v1.3',
      };
      const { executor, cleanup } = opts.makePipeline(config);
      try {
        const result = await executor.execute();
        if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
        const findings = findingsFromReport(result.data, spec, projectDir);
        return withConcreteFixes(findings, await lexicalEngine().evaluate({ projectDir, specPath, spec }));
      } finally {
        await cleanup();
      }
    },
  };
}

/** `findings` with the fix of a `lexical` row of the same key, where there is one. Pure. */
export function withConcreteFixes(findings: readonly GateFinding[], lexical: readonly GateFinding[]): GateFinding[] {
  const fixes = new Map<string, string>();
  for (const l of lexical) if (l.fix !== undefined && !fixes.has(findingKey(l))) fixes.set(findingKey(l), l.fix);
  return findings.map((f) => {
    const fix = fixes.get(findingKey(f));
    return fix === undefined ? f : { ...f, fix };
  });
}

const SOURCE_RE = /\.(?:[cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

/** Project-relative source files under `dir` (no `.d.ts`, no dependency or build directories), sorted. */
export function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(r);
      } else if (e.isFile() && SOURCE_RE.test(e.name) && !/\.d\.[cm]?ts$/.test(e.name)) out.push(r);
    }
  };
  walk('');
  return out.sort();
}

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

/**
 * The project file a relative specifier names, as the graph's target column gives it (`./Clock.js` -> `.../Clock.ts`);
 * the joined path itself when no file matches. Bare specifiers are package targets: their package root.
 */
export function resolveImportTarget(projectDir: string, fromFile: string, specifier: string): string {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    const parts = specifier.split('/');
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
  }
  const joined = normalisePath(path.posix.join(path.posix.dirname(fromFile), specifier));
  const stems = [joined, joined.replace(/\.(?:[cm]?js|jsx)$/, '')];
  for (const stem of stems) {
    for (const s of RESOLVE_SUFFIXES) {
      const candidate = `${stem}${s}`;
      const abs = path.join(projectDir, candidate);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return candidate;
    }
  }
  return joined;
}

/** `check_file`'s rules over every source file of the project, in process. */
export function lexicalEngine(): GateEngine {
  return {
    name: 'lexical',
    evaluate: ({ projectDir, spec }) => {
      const style = spec.style;
      const findings: GateFinding[] = [];
      for (const file of listSourceFiles(projectDir)) {
        const content = fs.readFileSync(path.join(projectDir, file), 'utf8');
        const result = checkSource(spec, { path: file, content });
        for (const v of result.violations) {
          const imported = /^import "(.*)"$/.exec(v.subject)?.[1];
          const target = imported === undefined ? undefined : resolveImportTarget(projectDir, file, imported);
          findings.push({
            ruleId: v.rule,
            ruleName: v.ruleName,
            tier: ruleTier(v.rule, style).tier,
            file: result.path,
            ...(target !== undefined ? { target } : {}),
            line: v.line,
            message: v.reason,
            fix: v.fix,
          });
        }
      }
      return Promise.resolve(findings);
    },
  };
}
