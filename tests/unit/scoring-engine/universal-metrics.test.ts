/**
 * U3-R8: bounded, File-typed universal metrics with visible failures
 * (FR-09, FR-34, NFR-07; U3 BR-U3-40..43, 45; TF-07, TF-08).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APG_MISSING, NO_CLASSES_OR_INTERFACES, NO_FILE_TO_FILE_IMPORTS, UNIVERSAL_METRIC_QUERIES, computeUniversalMetrics,
} from '../../../src/scoring-engine/universal-metrics.js';
import type { UniversalMetric, UniversalMetricsOutput } from '../../../src/scoring-engine/universal-metrics.js';
import { scoreAndAssemble } from './assembled-report-fixture.js';
import { csvHeader, formatCSV, formatHuman, metricText } from '../../../src/scoring-engine/report-formatter.js';
import { MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';
import { CYCLE_STRATEGY } from '../../../src/evaluation-engine/scc-cycles.js';
import type { CycleStrategy } from '../../../src/evaluation-engine/scc-cycles.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const ROOT = join(__dirname, '..', '..', '..');
const METRICS = Object.keys(UNIVERSAL_METRIC_QUERIES) as UniversalMetric[];

type Answer = readonly Record<string, unknown>[] | { readonly fail: string; readonly message?: string };

/** Repository stub answering each metric query by its text (`UNIVERSAL_METRIC_QUERIES`). */
function stubRepo(answers: Partial<Record<UniversalMetric, Answer>>, seen: string[] = []): GraphRepository {
  return {
    executeQuery(cypher: string): Promise<DomainResult<QueryResult>> {
      seen.push(cypher);
      const metric = METRICS.find((m) => UNIVERSAL_METRIC_QUERIES[m] === cypher);
      const answer = metric === undefined ? [] : answers[metric] ?? [];
      if (!Array.isArray(answer)) {
        const failure = answer as { fail: string; message?: string };
        return Promise.resolve(DomainResult.fail([{ code: failure.fail, message: failure.message ?? 'query failed' }]));
      }
      return Promise.resolve(DomainResult.ok({ records: answer as Record<string, unknown>[], summary: { counters: {} } }));
    },
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

async function metricsOf(repo: GraphRepository, strategy?: CycleStrategy, apg?: Pick<APGResult, 'nodes' | 'edges'>): Promise<UniversalMetricsOutput> {
  const r = await computeUniversalMetrics(repo, strategy, apg);
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

const POPULATED: Partial<Record<UniversalMetric, Answer>> = {
  cyclicDependencyCount: [{ cnt: 2 }],
  maxFanOut: [{ val: 3 }],
  maxFanIn: [{ val: 4 }],
  abstractionRatio: [{ val: 0.123456 }],
  averageInstability: [{ val: 0.4311 }],
  orphanFileCount: [{ cnt: 1 }],
};

describe('BR-U3-40 six bounded queries (static)', () => {
  it(`the cycle query is bounded *2..${String(MAX_CYCLE_LENGTH)} over IMPORTS|RE_EXPORTS on :File, never unbounded`, () => {
    const q = UNIVERSAL_METRIC_QUERIES.cyclicDependencyCount;
    expect(q).toBe('MATCH (f:File) WHERE EXISTS { (f)-[:IMPORTS|RE_EXPORTS*2..10]->(f) } RETURN count(f) AS cnt');
    expect(q).toContain('*2..10');
    for (const text of Object.values(UNIVERSAL_METRIC_QUERIES)) expect(text).not.toMatch(/\*\d*\.\.(?!\d)/);
  });

  it('the orphan query equals the U2 §10 predicate verbatim (no layer filter, barrels excluded)', () => {
    const u2 = readFileSync(join(ROOT, 'aidlc-docs/construction/v1.2E-u2-extractor-graph/functional-design/business-rules.md'), 'utf8');
    const quoted = /## 10\. Hand-offs to other units[\s\S]*?```cypher\n([\s\S]*?)\n```/.exec(u2)?.[1];
    expect(quoted).toBeDefined();
    expect(UNIVERSAL_METRIC_QUERIES.orphanFileCount).toBe(quoted);
    expect(UNIVERSAL_METRIC_QUERIES.orphanFileCount).not.toContain('layer');
  });

  it('fan-out, fan-in and instability stay IMPORTS-only and :File-typed (ADR-015 item 8)', () => {
    for (const m of ['maxFanOut', 'maxFanIn', 'averageInstability'] as const) {
      expect(UNIVERSAL_METRIC_QUERIES[m]).toContain(':IMPORTS]');
      expect(UNIVERSAL_METRIC_QUERIES[m]).not.toContain('RE_EXPORTS');
      expect(UNIVERSAL_METRIC_QUERIES[m]).toMatch(/:File\)[\s\S]*:File\)/);
    }
  });

  it('static: no `return 0` on a failed DomainResult in universal-metrics.ts (dead fallback removed)', () => {
    const src = readFileSync(join(ROOT, 'src/scoring-engine/universal-metrics.ts'), 'utf8');
    expect(src).not.toContain('return 0');
    const engine = readFileSync(join(ROOT, 'src/scoring-engine/scoring-engine.ts'), 'utf8');
    expect(engine).not.toContain('cyclicDependencyCount: 0');
  });

  it('runs each of the six queries once with the repository default timeout (no options)', async () => {
    const seen: string[] = [];
    await metricsOf(stubRepo(POPULATED, seen));
    expect([...seen].sort()).toEqual(Object.values(UNIVERSAL_METRIC_QUERIES).sort());
  });
});

describe('BR-U3-41/42 values, failures and empty results', () => {
  it('populated graph: counts as returned, ratios rounded to three decimals, no warning', async () => {
    const out = await metricsOf(stubRepo(POPULATED));
    expect(out.metrics).toEqual({
      cyclicDependencyCount: 2, maxFanOut: 3, maxFanIn: 4, abstractionRatio: 0.123, averageInstability: 0.431, orphanFileCount: 1,
    });
    expect(out.warnings).toEqual([]);
  });

  it('TF-07 empty graph: 0, 0, 0, null, null, 0 with two METRIC_002 and no METRIC_001', async () => {
    const out = await metricsOf(stubRepo({
      cyclicDependencyCount: [{ cnt: 0 }], maxFanOut: [{ val: null }], maxFanIn: [], abstractionRatio: [],
      averageInstability: [{ val: null }], orphanFileCount: [{ cnt: 0 }],
    }));
    expect(out.metrics).toEqual({
      cyclicDependencyCount: 0, maxFanOut: 0, maxFanIn: 0, abstractionRatio: null, averageInstability: null, orphanFileCount: 0,
    });
    expect(out.warnings.map((w) => [w.code, w.context])).toEqual([
      ['METRIC_002', { metric: 'abstractionRatio', reason: NO_CLASSES_OR_INTERFACES }],
      ['METRIC_002', { metric: 'averageInstability', reason: NO_FILE_TO_FILE_IMPORTS }],
    ]);
    expect([NO_CLASSES_OR_INTERFACES, NO_FILE_TO_FILE_IMPORTS]).toEqual(['no classes or interfaces', 'no file-to-file imports']);
  });

  it('TF-08 BR-U3-41: the cycle query fails → cyclicDependencyCount null, one scrubbed METRIC_001 {metric, code}, the other five computed', async () => {
    const out = await metricsOf(stubRepo({
      ...POPULATED,
      cyclicDependencyCount: { fail: 'NEO4J_QUERY_FAILED', message: 'query timed out (token s3cr3t-value)' },
    }));
    expect(out.metrics).toEqual({
      cyclicDependencyCount: null, maxFanOut: 3, maxFanIn: 4, abstractionRatio: 0.123, averageInstability: 0.431, orphanFileCount: 1,
    });
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]?.code).toBe('METRIC_001');
    expect(out.warnings[0]?.context).toEqual({ metric: 'cyclicDependencyCount', code: 'NEO4J_QUERY_FAILED' });
    expect(JSON.stringify(out.warnings)).not.toContain('s3cr3t');
  });

  it('every failed metric is null with its own METRIC_001; null never appears without a warning', async () => {
    const all = Object.fromEntries(METRICS.map((m) => [m, { fail: 'EVAL_002' }])) as Record<UniversalMetric, Answer>;
    const out = await metricsOf(stubRepo(all));
    expect(Object.values(out.metrics)).toEqual([null, null, null, null, null, null]);
    expect(out.warnings.map((w) => w.context?.metric)).toEqual(METRICS);
    expect(out.warnings.every((w) => w.code === 'METRIC_001')).toBe(true);
  });
});

describe('BR-U3-45 cycle strategy', () => {
  const file = (p: string): APGNode => ({ id: `id:${p}`, type: 'File', filePath: p, name: p, decorators: [], properties: {} });
  const edge = (a: string, b: string): APGEdge => ({ id: `${a}->${b}`, type: 'IMPORTS', sourceId: `id:${a}`, targetId: `id:${b}`, properties: {} });
  const apg: Pick<APGResult, 'nodes' | 'edges'> = { nodes: ['a.ts', 'b.ts', 'c.ts'].map(file), edges: [edge('a.ts', 'b.ts'), edge('b.ts', 'a.ts'), edge('b.ts', 'c.ts')] };

  it("CYCLE_STRATEGY is 'cypher' (frozen, BR-U3-70 item 3)", () => {
    expect(CYCLE_STRATEGY).toBe('cypher');
  });

  it("'scc' counts the files in SCCs of size ≥ 2 from the APG and never runs the cycle query", async () => {
    const seen: string[] = [];
    const out = await metricsOf(stubRepo(POPULATED, seen), 'scc', apg);
    expect(out.metrics.cyclicDependencyCount).toBe(2);
    expect(seen).not.toContain(UNIVERSAL_METRIC_QUERIES.cyclicDependencyCount);
  });

  it("'scc' without an APG → cyclicDependencyCount null and METRIC_001 {code: 'APG_MISSING'}", async () => {
    const out = await metricsOf(stubRepo(POPULATED), 'scc');
    expect(out.metrics.cyclicDependencyCount).toBeNull();
    expect(out.warnings.map((w) => [w.code, w.context])).toEqual([['METRIC_001', { metric: 'cyclicDependencyCount', code: APG_MISSING }]]);
  });
});

describe('BR-U3-43 null printing and warning propagation', () => {
  async function reportWith(answers: Partial<Record<UniversalMetric, Answer>>): Promise<DomainResult<EvaluationReport>> {
    return scoreAndAssemble({
      evaluationResults: {
        symbolicResults: [{ functionId: functionId('FF-S01'), dimension: 'structural', passed: true, violations: [], executionTimeMs: 1, deterministic: true }],
        neuronalResults: [],
      },
      scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
      confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
      verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
      mode: 'symbolic-only',
      projectPath: '/p',
      specVersion: '1',
      graphRepository: stubRepo(answers),
      fitnessFunctions: [],
      compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
      noJudgeUnits: [],
    });
  }

  it('metricText prints null as n/a and keeps numbers', () => {
    expect(metricText(null)).toBe('n/a');
    expect(metricText(null, 3)).toBe('n/a');
    expect(metricText(0.2, 3)).toBe('0.200');
    expect(metricText(0)).toBe('0');
  });

  it('human and CSV output print a null abstractionRatio as n/a, never null; JSON keeps null; the CSV row matches the header', async () => {
    const r = await reportWith({ ...POPULATED, abstractionRatio: [] });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.universalMetrics.abstractionRatio).toBeNull();
    const human = formatHuman(r.data);
    expect(human).toContain('Abstraction ratio: n/a');
    expect(human).not.toContain('null');
    const csv = formatCSV(r.data);
    expect(csv.split(',')).toContain('n/a');
    expect(csv).not.toContain('null');
    expect(csv.split(',')).toHaveLength(csvHeader().split(',').length);
    expect(JSON.stringify(r.data.universalMetrics)).toContain('"abstractionRatio":null');
  });

  it('metric warnings travel as the scoring result warnings (no silent zero)', async () => {
    const r = await reportWith({ ...POPULATED, orphanFileCount: { fail: 'NEO4J_QUERY_FAILED' } });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.universalMetrics.orphanFileCount).toBeNull();
    // Since U3-R10 the assembled report carries them (computeScores removed): stage compute-scores.
    expect(r.data.warnings.filter((w) => w.code.startsWith('METRIC_')).map((w) => [w.code, w.context, w.stage]))
      .toEqual([['METRIC_001', { metric: 'orphanFileCount', code: 'NEO4J_QUERY_FAILED' }, 'compute-scores']]);
  });
});
