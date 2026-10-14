import * as path from 'node:path';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import {
  MAX_LISTED_PER_RULE,
  evaluateProject,
  groupByRule,
  neo4jEnvFrom,
} from '../../../src/mcp-server/evaluate-project.js';
import type { EvaluateDeps } from '../../../src/mcp-server/evaluate-project.js';
import { CLEAN_ARCH_SPEC, FIXTURES } from './helpers.js';

const PROJECT = path.join(FIXTURES, 'variant-a-structural');
const ENV = {
  NEO4J_URI: 'bolt://db.internal:7687',
  NEO4J_USER: 'neo4j',
  NEO4J_PASSWORD: 'hunter2-hunter2',
};

function violation(functionId: string, filePath: string, extra: object = {}) {
  return {
    id: `${functionId}:${filePath}`,
    functionId,
    filePath,
    message: `bad ${filePath}`,
    severity: 'critical',
    ...extra,
  };
}

function report(overrides: object = {}): EvaluationReport {
  return {
    ahsDeterministic: 0.442,
    verdict: 'hard-block',
    durationMs: 1234,
    functionResults: [
      { functionId: 'FF-S01', name: 'dependency-direction' },
      { functionId: 'FF-S02', name: 'no-cyclic-deps' },
    ],
    violations: [
      violation('FF-S02', 'src/a.ts'),
      violation('FF-S01', 'src/domain/entities/Task.ts', {
        line: 2,
        target: 'src/infrastructure/config/InfraConfig.ts',
      }),
      violation('FF-S01', 'src/application/use-cases/CreateTaskUseCase.ts', { line: 2 }),
    ],
    ...overrides,
  } as unknown as EvaluationReport;
}

interface Harness {
  readonly deps: EvaluateDeps;
  readonly healthCheck: jest.Mock;
  readonly closeGraph: jest.Mock;
  readonly configs: PipelineConfig[];
  readonly cleanup: jest.Mock;
}

function harness(
  opts: { reachable?: boolean; pipeline?: () => Promise<DomainResult<EvaluationReport>> } = {},
): Harness {
  const healthCheck = jest.fn().mockResolvedValue(opts.reachable ?? true);
  const closeGraph = jest.fn().mockResolvedValue(undefined);
  const graph: GraphRepository = {
    executeQuery: jest.fn(),
    clearGraph: jest.fn(),
    healthCheck,
    close: closeGraph,
  };
  const configs: PipelineConfig[] = [];
  const cleanup = jest.fn().mockResolvedValue(undefined);
  const run = opts.pipeline ?? (() => Promise.resolve(DomainResult.ok(report())));
  const deps: EvaluateDeps = {
    makeGraph: () => graph,
    makePipeline: (config) => {
      configs.push(config);
      return { executor: { execute: run } as never, cleanup };
    },
    connectTimeoutMs: 50,
  };
  return { deps, healthCheck, closeGraph, configs, cleanup };
}

describe('evaluate_project', () => {
  it('runs the symbolic-only pipeline and summarises AHS, verdict and violations by rule', async () => {
    const h = harness();
    const result = await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      ENV,
      h.deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      projectPath: PROJECT,
      specPath: CLEAN_ARCH_SPEC,
      evaluationMode: 'symbolic-only',
      ahs: 0.442,
      verdict: 'hard-block',
      violationCount: 3,
      durationMs: 1234,
    });
    expect(result.data.byRule.map((g) => [g.ruleId, g.ruleName, g.count])).toEqual([
      ['FF-S01', 'dependency-direction', 2],
      ['FF-S02', 'no-cyclic-deps', 1],
    ]);
    expect(result.data.byRule[0]?.violations[0]).toEqual({
      filePath: 'src/domain/entities/Task.ts',
      line: 2,
      target: 'src/infrastructure/config/InfraConfig.ts',
      message: 'bad src/domain/entities/Task.ts',
      severity: 'critical',
    });
    expect(h.cleanup).toHaveBeenCalledTimes(1);
  });

  it('configures the pipeline like the CLI: symbolic-only, stateless, no persistence, Neo4j from the environment', async () => {
    const h = harness();
    await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      { ...ENV, APG_STORE_PATH: '/tmp/apg' },
      h.deps,
    );
    expect(h.configs).toEqual([
      {
        projectPath: PROJECT,
        specFilePath: CLEAN_ARCH_SPEC,
        neo4jUri: ENV.NEO4J_URI,
        neo4jUser: 'neo4j',
        neo4jPassword: ENV.NEO4J_PASSWORD,
        evaluationMode: 'symbolic-only',
        pipelineMode: 'stateless',
        persist: false,
        diff: false,
        verbose: false,
        apgStorePath: '/tmp/apg',
      },
    ]);
  });

  it('reports AHS null when the report carries no deterministic score', async () => {
    const h = harness({
      pipeline: () => Promise.resolve(DomainResult.ok(report({ ahsDeterministic: undefined }))),
    });
    const result = await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      ENV,
      h.deps,
    );
    expect(result.success && result.data.ahs).toBeNull();
  });

  it('fails with a clear message when Neo4j is unreachable, before building the pipeline', async () => {
    const h = harness({ reachable: false });
    const result = await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      ENV,
      h.deps,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.code).toBe('NEO4J_UNREACHABLE');
    expect(result.errors[0]?.message).toMatch(/Neo4j is not reachable/);
    expect(result.errors[0]?.message).toMatch(/NEO4J_URI/);
    expect(result.errors[0]?.message).not.toContain(ENV.NEO4J_PASSWORD);
    expect(result.errors[0]?.message).not.toContain('db.internal');
    expect(h.configs).toHaveLength(0);
    expect(h.closeGraph).toHaveBeenCalled();
  });

  it('treats a probe that never answers as unreachable', async () => {
    const h = harness();
    h.healthCheck.mockReturnValue(new Promise<boolean>(() => undefined));
    const result = await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      ENV,
      h.deps,
    );
    expect(!result.success && result.errors[0]?.code).toBe('NEO4J_UNREACHABLE');
  });

  it('fails with a clear message when NEO4J_PASSWORD is missing, without probing Neo4j', async () => {
    const h = harness();
    const result = await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      {},
      h.deps,
    );
    expect(!result.success && result.errors[0]).toMatchObject({ code: 'CONFIG_MISSING_ENV' });
    expect(!result.success && result.errors[0]?.message).toMatch(/NEO4J_PASSWORD is not set/);
    expect(h.healthCheck).not.toHaveBeenCalled();
  });

  it('fails for a missing project or spec before any connection', async () => {
    const h = harness();
    const noProject = await evaluateProject(
      { projectPath: path.join(FIXTURES, 'nope'), specPath: CLEAN_ARCH_SPEC },
      ENV,
      h.deps,
    );
    expect(!noProject.success && noProject.errors[0]?.code).toBe('PROJECT_NOT_FOUND');
    const noSpec = await evaluateProject(
      { projectPath: PROJECT, specPath: '/nope/spec.yaml' },
      ENV,
      h.deps,
    );
    expect(!noSpec.success && noSpec.errors[0]?.code).toBe('SPEC_NOT_FOUND');
    expect(h.healthCheck).not.toHaveBeenCalled();
  });

  it('turns a failed pipeline into PIPELINE_FAILED and still cleans up', async () => {
    const h = harness({
      pipeline: () =>
        Promise.resolve(
          DomainResult.fail<EvaluationReport>([
            { code: 'X', message: `ingest failed for ${ENV.NEO4J_PASSWORD}` },
          ]),
        ),
    });
    const result = await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      ENV,
      h.deps,
    );
    expect(!result.success && result.errors[0]?.code).toBe('PIPELINE_FAILED');
    expect(!result.success && result.errors[0]?.message).not.toContain(ENV.NEO4J_PASSWORD);
    expect(h.cleanup).toHaveBeenCalledTimes(1);
  });

  it('turns a thrown pipeline error into PIPELINE_FAILED and still cleans up', async () => {
    const h = harness({ pipeline: () => Promise.reject(new Error('boom')) });
    const result = await evaluateProject(
      { projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC },
      ENV,
      h.deps,
    );
    expect(!result.success && result.errors[0]).toMatchObject({
      code: 'PIPELINE_FAILED',
      message: 'boom',
    });
    expect(h.cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('groupByRule', () => {
  it('caps the listing per rule but keeps the full count', () => {
    const many = Array.from({ length: MAX_LISTED_PER_RULE + 5 }, (_, i) =>
      violation('FF-S01', `src/f${String(i)}.ts`),
    );
    const [group] = groupByRule(report({ violations: many }));
    expect(group).toMatchObject({
      ruleId: 'FF-S01',
      count: MAX_LISTED_PER_RULE + 5,
      truncated: true,
    });
    expect(group?.violations).toHaveLength(MAX_LISTED_PER_RULE);
  });

  it('falls back to the rule id when the report has no name for it', () => {
    const [group] = groupByRule(
      report({ functionResults: [], violations: [violation('FF-X', 'a.ts')] }),
    );
    expect(group).toMatchObject({ ruleName: 'FF-X', truncated: false });
  });
});

describe('neo4jEnvFrom', () => {
  it('defaults the URI, user and store path; requires the password', () => {
    expect(neo4jEnvFrom({ NEO4J_PASSWORD: 'pw' })).toEqual({
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'pw',
      apgStorePath: '.apg-store',
    });
    expect(() => neo4jEnvFrom({ NEO4J_PASSWORD: '' })).toThrow('NEO4J_PASSWORD is not set');
  });
});
