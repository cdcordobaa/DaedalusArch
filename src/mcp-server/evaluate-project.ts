/**
 * `evaluate_project`: the existing symbolic-only pipeline on a project path, summarised as AHS, verdict and
 * violations by rule. The pipeline and the Neo4j repository are injected ports, so the unit tests run without a
 * database; production wiring uses `createPipeline` and `Neo4jRepository` unchanged.
 *
 * Note for callers: the pipeline ingests the project's graph into Neo4j and clears the previous one (as the CLI
 * does), so the target database must be a scratch instance.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { EvaluationReport } from '../shared/types/evaluation.js';
import type { DomainResult } from '../shared/errors/domain-result.js';
import { DomainResult as Result } from '../shared/errors/domain-result.js';
import { neo4jScrubPolicy, scrubWithPolicy } from '../shared/errors/scrub.js';
import type { PipelineConfig } from '../pipeline/types.js';
import type { PipelineBundle } from '../pipeline/pipeline-factory.js';
import { MissingEnvError, requireEnv } from '../cli/require-env.js';
import type { EvaluateProjectResult, Neo4jEnv, RuleViolationGroup } from './types.js';

/** Violations listed per rule; `count` always holds the full number. */
export const MAX_LISTED_PER_RULE = 25;

/** Milliseconds the Neo4j reachability probe waits before the tool reports the database unreachable. */
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

export interface EvaluateDeps {
  readonly makeGraph: (env: Neo4jEnv) => GraphRepository;
  readonly makePipeline: (config: PipelineConfig) => Pick<PipelineBundle, 'executor' | 'cleanup'>;
  readonly connectTimeoutMs?: number;
}

export interface EvaluateInput {
  readonly projectPath: string;
  readonly specPath: string;
}

/** The Neo4j settings from the environment (the CLI's variables); throws `MissingEnvError` for no password. */
export function neo4jEnvFrom(env: NodeJS.ProcessEnv): Neo4jEnv {
  return {
    uri: env.NEO4J_URI ?? 'bolt://localhost:7687',
    user: env.NEO4J_USER ?? 'neo4j',
    password: requireEnv('NEO4J_PASSWORD', env),
    apgStorePath: env.APG_STORE_PATH ?? '.apg-store',
  };
}

function failure(code: string, message: string): DomainResult<EvaluateProjectResult> {
  return Result.fail([{ code, message }]);
}

async function reachable(graph: GraphRepository, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
  });
  try {
    return await Promise.race([graph.healthCheck(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Violations grouped by rule id, in rule-id order, each listing at most `MAX_LISTED_PER_RULE` rows. */
export function groupByRule(report: EvaluationReport): readonly RuleViolationGroup[] {
  const names = new Map(report.functionResults.map((r) => [String(r.functionId), r.name]));
  const groups = new Map<string, EvaluationReport['violations'][number][]>();
  for (const v of report.violations) {
    const id = String(v.functionId);
    groups.set(id, [...(groups.get(id) ?? []), v]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruleId, rows]) => ({
      ruleId,
      ruleName: names.get(ruleId) ?? ruleId,
      count: rows.length,
      truncated: rows.length > MAX_LISTED_PER_RULE,
      violations: rows.slice(0, MAX_LISTED_PER_RULE).map((v) => ({
        filePath: v.filePath,
        ...(v.line !== undefined ? { line: v.line } : {}),
        ...(v.target !== undefined ? { target: v.target } : {}),
        message: v.message,
        severity: v.severity,
      })),
    }));
}

export async function evaluateProject(
  input: EvaluateInput,
  env: NodeJS.ProcessEnv,
  deps: EvaluateDeps,
): Promise<DomainResult<EvaluateProjectResult>> {
  const projectPath = path.resolve(input.projectPath);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    return failure('PROJECT_NOT_FOUND', `Project path is not a directory: ${projectPath}`);
  }
  if (!fs.existsSync(input.specPath)) {
    return failure('SPEC_NOT_FOUND', `Spec file not found: ${input.specPath}`);
  }

  let neo4j: Neo4jEnv;
  try {
    neo4j = neo4jEnvFrom(env);
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return failure(
        'CONFIG_MISSING_ENV',
        `${err.variable} is not set. evaluate_project needs a Neo4j instance: set NEO4J_PASSWORD (and NEO4J_URI, NEO4J_USER if not the defaults) in the MCP server's environment.`,
      );
    }
    throw err;
  }
  const policy = neo4jScrubPolicy({
    neo4jUri: neo4j.uri,
    neo4jUser: neo4j.user,
    neo4jPassword: neo4j.password,
  });

  const graph = deps.makeGraph(neo4j);
  let up: boolean;
  try {
    up = await reachable(graph, deps.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
  } finally {
    await graph.close().catch(() => undefined);
  }
  if (!up) {
    return failure(
      'NEO4J_UNREACHABLE',
      scrubWithPolicy(
        `Neo4j is not reachable at the configured NEO4J_URI (user ${neo4j.user}); the address is withheld from messages. Start it (docker compose up -d) or fix NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD in the MCP server's environment. evaluate_project cannot run without it; get_architecture_spec, which_layer, check_import and explain_violation still work.`,
        policy,
      ),
    );
  }

  const config: PipelineConfig = {
    projectPath,
    specFilePath: input.specPath,
    neo4jUri: neo4j.uri,
    neo4jUser: neo4j.user,
    neo4jPassword: neo4j.password,
    evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless',
    persist: false,
    diff: false,
    verbose: false,
    apgStorePath: neo4j.apgStorePath,
  };
  const { executor, cleanup } = deps.makePipeline(config);
  try {
    const result = await executor.execute();
    if (!result.success) {
      return failure(
        'PIPELINE_FAILED',
        scrubWithPolicy(result.errors.map((e) => e.message).join('; '), policy),
      );
    }
    const report = result.data;
    return Result.ok({
      projectPath,
      specPath: input.specPath,
      evaluationMode: 'symbolic-only',
      ahs: report.ahsDeterministic ?? null,
      verdict: report.verdict,
      violationCount: report.violations.length,
      byRule: groupByRule(report),
      durationMs: report.durationMs,
    });
  } catch (err) {
    return failure(
      'PIPELINE_FAILED',
      scrubWithPolicy(err instanceof Error ? err.message : String(err), policy),
    );
  } finally {
    await cleanup();
  }
}
