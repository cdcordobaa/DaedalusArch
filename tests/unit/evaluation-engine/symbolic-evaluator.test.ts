import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';

function mockGraphRepo(responses: Map<string, Record<string, unknown>[]>): GraphRepository {
  return {
    async executeQuery(cypher: string): Promise<DomainResult<QueryResult>> {
      for (const [key, records] of responses) {
        if (cypher.includes(key)) {
          return DomainResult.ok({ records, summary: { counters: {} } });
        }
      }
      return DomainResult.ok({ records: [], summary: { counters: {} } });
    },
    async clearGraph() { return DomainResult.ok(undefined); },
    async healthCheck() { return true; },
    async close() {},
  };
}

function failingGraphRepo(): GraphRepository {
  return {
    async executeQuery(): Promise<DomainResult<QueryResult>> {
      return DomainResult.fail([{ code: 'NEO4J_ERROR', message: 'Connection refused' }]);
    },
    async clearGraph() { return DomainResult.ok(undefined); },
    async healthCheck() { return false; },
    async close() {},
  };
}

const makeQuery = (name: string, cypher: string, threshold?: number): CypherQuery => ({
  functionId: functionId(`FF-${name}`),
  name,
  cypher,
  params: {},
  dimension: 'structural',
  severity: 'critical',
  ...(threshold != null ? { threshold } : {}),
  route: 'symbolic',
  source: 'template' as const,
});

describe('symbolic-evaluator', () => {
  it('returns pass when query yields no records', async () => {
    const repo = mockGraphRepo(new Map());
    const result = await evaluateSymbolic({
      queries: [makeQuery('test-fn', 'MATCH (n) RETURN n')],
      graphRepository: repo,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].passed).toBe(true);
      expect(result.data.results[0].violations).toHaveLength(0);
      expect(result.data.results[0].deterministic).toBe(true);
    }
  });

  it('returns fail with violations when query yields records', async () => {
    const repo = mockGraphRepo(new Map([
      ['MATCH', [{ filePath: 'src/bad.ts', srcLayer: 'infra', tgtLayer: 'domain' }]],
    ]));
    const result = await evaluateSymbolic({
      queries: [makeQuery('dep-check', 'MATCH (n) RETURN n.filePath AS filePath')],
      graphRepository: repo,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results[0].passed).toBe(false);
      expect(result.data.results[0].violations.length).toBeGreaterThan(0);
      expect(result.data.results[0].violations[0].filePath).toBe('src/bad.ts');
    }
  });

  it('skips function and warns when query fails', async () => {
    const repo = failingGraphRepo();
    const result = await evaluateSymbolic({
      queries: [makeQuery('fail-fn', 'MATCH (n) RETURN n')],
      graphRepository: repo,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(0); // skipped
      expect(result.data.warnings.length).toBeGreaterThan(0);
      expect(result.data.warnings[0].code).toBe('EVAL_001');
    }
  });

  it('records execution time', async () => {
    const repo = mockGraphRepo(new Map());
    const result = await evaluateSymbolic({
      queries: [makeQuery('timing', 'MATCH (n) RETURN n')],
      graphRepository: repo,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results[0].executionTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles multiple queries', async () => {
    const repo = mockGraphRepo(new Map([
      ['query1', [{ filePath: 'a.ts' }]],
    ]));
    const result = await evaluateSymbolic({
      queries: [
        makeQuery('fn1', 'query1'),
        makeQuery('fn2', 'query2'),
      ],
      graphRepository: repo,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0].passed).toBe(false); // query1 has violations
      expect(result.data.results[1].passed).toBe(true); // query2 no results
    }
  });
});
