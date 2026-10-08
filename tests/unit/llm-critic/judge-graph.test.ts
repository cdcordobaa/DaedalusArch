/**
 * U4 plan Step 21: `loadJudgeGraphView` over a `GraphRepository` fake that answers with
 * recorded `QueryResult` fixtures (`tests/fixtures/judge-graph/*.json`, recorded from the lane
 * graph after ingesting the fixture with U2's ingester). Asserts each query's text, params and
 * `timeoutMs`, the resulting view, and that every read error becomes `CRITIC_001`, never a throw.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryOptions, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import {
  JUDGE_GRAPH_QUERIES, JUDGE_GRAPH_READ_TIMEOUT_MS, loadJudgeGraphView,
} from '../../../src/llm-critic/judge-graph.js';
import type { JudgeGraphView } from '../../../src/llm-critic/judge-graph.js';
import { assembleUnitSource, assembleUnitSourceFromView } from '../../../src/llm-critic/source-context.js';
import { DEFAULT_TOKEN_BUDGET } from '../../../src/llm-critic/types.js';
import type { JudgeUnit } from '../../../src/llm-critic/judge-unit-selector.js';

const REPO = path.resolve(__dirname, '../../..');
const FIX = path.join(REPO, 'tests/fixtures/judge-graph');

type QueryName = keyof typeof JUDGE_GRAPH_QUERIES;
const QUERY_NAMES: readonly QueryName[] = ['files', 'classes', 'interfaces', 'edges'];

function recorded(fixture: string, name: QueryName): QueryResult {
  return JSON.parse(fs.readFileSync(path.join(FIX, `${fixture}.${name}.json`), 'utf8')) as QueryResult;
}

function expectedView(fixture: string): JudgeGraphView {
  return JSON.parse(fs.readFileSync(path.join(FIX, `${fixture}.view.json`), 'utf8')) as JudgeGraphView;
}

interface Call { readonly cypher: string; readonly params: unknown; readonly options: QueryOptions | undefined }

function fakeRepo(answer: (name: QueryName | undefined) => DomainResult<QueryResult>, calls: Call[] = []): GraphRepository {
  const byText = new Map<string, QueryName>(QUERY_NAMES.map((n) => [JUDGE_GRAPH_QUERIES[n], n]));
  return {
    executeQuery: (cypher: string, params?: Record<string, unknown>, options?: QueryOptions) => {
      calls.push({ cypher, params, options });
      return Promise.resolve(answer(byText.get(cypher)));
    },
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

function recordedRepo(fixture: string, calls: Call[] = []): GraphRepository {
  return fakeRepo((name) => (name === undefined
    ? DomainResult.fail([{ code: 'NEO4J_QUERY_FAILED', message: 'unexpected query' }])
    : DomainResult.ok(recorded(fixture, name))), calls);
}

describe('loadJudgeGraphView (Step 21 reader)', () => {
  it.each(['variant-a-structural', 'correct-reference'])('fills the view of %s from the recorded query results', async (fixture) => {
    const calls: Call[] = [];
    const view = await loadJudgeGraphView(recordedRepo(fixture, calls), 1234);
    expect(view.success).toBe(true);
    if (view.success) expect(view.data).toEqual(expectedView(fixture));
    expect(calls.map((c) => c.cypher)).toEqual(QUERY_NAMES.map((n) => JUDGE_GRAPH_QUERIES[n]));
    for (const c of calls) {
      expect(c.params).toEqual({});
      expect(c.options).toEqual({ timeoutMs: 1234 });
    }
  });

  it('uses the read timeout by default', async () => {
    const calls: Call[] = [];
    await loadJudgeGraphView(recordedRepo('variant-a-structural', calls));
    expect(calls.every((c) => c.options?.timeoutMs === JUDGE_GRAPH_READ_TIMEOUT_MS)).toBe(true);
  });

  it('every query is read-only and ordered, over U2 labels and property names', () => {
    for (const name of QUERY_NAMES) {
      const q = JUDGE_GRAPH_QUERIES[name];
      expect(q).toMatch(/^MATCH /);
      expect(q).toContain('ORDER BY');
      expect(q).not.toMatch(/\b(CREATE|MERGE|SET|DELETE|REMOVE|DETACH)\b/);
    }
    expect(JUDGE_GRAPH_QUERIES.files).toContain('f.filePath');
    expect(JUDGE_GRAPH_QUERIES.files).toContain('f.isBarrel');
    expect(JUDGE_GRAPH_QUERIES.classes).toContain('[:DECLARES]->(c:Class)');
    expect(JUDGE_GRAPH_QUERIES.interfaces).toContain('[:DECLARES]->(i:Interface)');
    expect(JUDGE_GRAPH_QUERIES.edges).toContain('IMPORTS|RE_EXPORTS|CONSTRUCTOR_INJECTS|FLOWS_TO|EXTENDS|IMPLEMENTS');
  });

  it.each(QUERY_NAMES)('a failing %s query is CRITIC_001, not a throw', async (failing) => {
    const repo = fakeRepo((name) => (name === failing
      ? DomainResult.fail([{ code: 'NEO4J_QUERY_FAILED', message: 'boom' }])
      : DomainResult.ok(recorded('variant-a-structural', name ?? 'files'))));
    const view = await loadJudgeGraphView(repo);
    expect(view.success).toBe(false);
    if (!view.success) {
      expect(view.errors[0]?.code).toBe('CRITIC_001');
      expect(view.errors[0]?.message).toContain(failing);
    }
  });

  it('a repository that throws is CRITIC_001', async () => {
    const repo = fakeRepo(() => { throw new Error('driver down'); });
    const view = await loadJudgeGraphView(repo);
    expect(view.success).toBe(false);
    if (!view.success) expect(view.errors[0]?.code).toBe('CRITIC_001');
  });

  it('a malformed row is CRITIC_001', async () => {
    const repo = fakeRepo((name) => (name === 'edges'
      ? DomainResult.ok({ records: [{ type: 'CALLS', from: 'a', to: 'b' }], summary: { counters: {} } })
      : DomainResult.ok(recorded('variant-a-structural', name ?? 'files'))));
    const view = await loadJudgeGraphView(repo);
    expect(view.success).toBe(false);
  });
});

describe('assembleUnitSource (DE §3.1 export) reads the view through the Step 21 reader', () => {
  const ROOT = path.join(REPO, 'fixtures/correct-reference');
  const UNIT: JudgeUnit = {
    id: 'src/domain/entities/Task.ts', kind: 'file', layer: 'domain', filePaths: ['src/domain/entities/Task.ts'], sizeTokens: 0, singleFile: true,
  };

  it('equals the pure core over the same view', async () => {
    const viaRepo = await assembleUnitSource(UNIT, ROOT, recordedRepo('correct-reference'), DEFAULT_TOKEN_BUDGET);
    const pure = assembleUnitSourceFromView(UNIT, ROOT, expectedView('correct-reference'), DEFAULT_TOKEN_BUDGET);
    expect(viaRepo).toEqual(pure);
    expect(viaRepo.success).toBe(true);
  });

  it('a graph read failure is CRITIC_001', async () => {
    const repo = fakeRepo(() => DomainResult.fail([{ code: 'NEO4J_QUERY_FAILED', message: 'down' }]));
    const result = await assembleUnitSource(UNIT, ROOT, repo, DEFAULT_TOKEN_BUDGET);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('CRITIC_001');
  });
});
