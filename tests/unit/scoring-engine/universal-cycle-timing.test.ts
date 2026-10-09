/**
 * ADR-021 SO2; audit SO2-2: the universal cycle metric is timed on its own (ADR-016 e: both cycle queries of the
 * H13 gate), and the pipeline carries the time into `report.timings.stages` as a sub-stage entry.
 */
import { computeUniversalMetrics, UNIVERSAL_CYCLE_STAGE, UNIVERSAL_METRIC_QUERIES } from '../../../src/scoring-engine/universal-metrics.js';
import type { UniversalMetric } from '../../../src/scoring-engine/universal-metrics.js';
import { cycleMetricStage, withSubStages } from '../../../src/pipeline/pipeline-factory.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';

const METRICS = Object.keys(UNIVERSAL_METRIC_QUERIES) as UniversalMetric[];

/** Repository stub: the cycle query fails with `cycleFail` when given; every query is logged in call order. */
function repo(log: string[], cycleFail?: string): GraphRepository {
  return {
    executeQuery(cypher: string): Promise<DomainResult<QueryResult>> {
      const metric = METRICS.find((m) => UNIVERSAL_METRIC_QUERIES[m] === cypher) ?? '?';
      log.push(`start ${metric}`);
      if (metric === 'cyclicDependencyCount' && cycleFail !== undefined) {
        log.push(`end ${metric}`);
        return Promise.resolve(DomainResult.fail([{ code: cycleFail, message: 'timed out' }]));
      }
      const field = metric === 'cyclicDependencyCount' || metric === 'orphanFileCount' ? 'cnt' : 'val';
      return new Promise((done) => {
        setImmediate(() => {
          log.push(`end ${metric}`);
          done(DomainResult.ok({ records: [{ [field]: 1 }], summary: { counters: {} } }));
        });
      });
    },
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

/** A clock returning the given readings in order. */
function clock(...readings: number[]): () => number {
  let i = 0;
  return () => readings[Math.min(i++, readings.length - 1)] ?? 0;
}

describe('universal cycle metric timing (ADR-016 e; audit SO2-2)', () => {
  it('runs the cycle query alone and first, and returns its wall time (100.2 -> 1350.7 = 1251 ms, rounded)', async () => {
    const log: string[] = [];
    const r = await computeUniversalMetrics(repo(log), 'cypher', undefined, clock(100.2, 1350.7));
    if (!r.success) throw new Error('metrics failed');
    expect(r.data.cycleTiming).toEqual({ durationMs: 1251, failed: false });
    // The cycle query ends before any other metric query starts.
    expect(log.slice(0, 2)).toEqual(['start cyclicDependencyCount', 'end cyclicDependencyCount']);
    expect(log.filter((l) => l.startsWith('start'))).toHaveLength(6);
  });

  it('a failed cycle query is timed and marked failed with the repository code', async () => {
    const r = await computeUniversalMetrics(repo([], 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration'), 'cypher', undefined, clock(0, 30_004));
    if (!r.success) throw new Error('metrics failed');
    expect(r.data.cycleTiming).toEqual({ durationMs: 30_004, failed: true, code: 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration' });
    expect(r.data.metrics.cyclicDependencyCount).toBeNull();
  });

  it('the SCC path without an APG is a failed timing with APG_MISSING', async () => {
    const r = await computeUniversalMetrics(repo([]), 'scc', undefined, clock(5, 5));
    if (!r.success) throw new Error('metrics failed');
    expect(r.data.cycleTiming).toEqual({ durationMs: 0, failed: true, code: 'APG_MISSING' });
  });
});

describe('cycle-metric sub-stage in report timings', () => {
  it('maps a timing to the UNIVERSAL_CYCLE_STAGE entry', () => {
    expect(cycleMetricStage({ durationMs: 812, failed: false })).toEqual({ name: UNIVERSAL_CYCLE_STAGE, durationMs: 812, status: 'success' });
    expect(cycleMetricStage({ durationMs: 30_001, failed: true, code: 'x' })).toEqual({ name: UNIVERSAL_CYCLE_STAGE, durationMs: 30_001, status: 'error' });
  });

  it('appends sub-stages after the executor stages and keeps totalMs (a sub-stage is inside its parent)', () => {
    const t = { stages: [{ name: 'extract-apg', durationMs: 40, status: 'success' as const }, { name: 'compute-scores', durationMs: 900, status: 'success' as const }], totalMs: 940 };
    const sub = [{ name: UNIVERSAL_CYCLE_STAGE, durationMs: 812, status: 'success' as const }];
    expect(withSubStages(t, sub)).toEqual({ stages: [...t.stages, ...sub], totalMs: 940 });
    expect(withSubStages(t, [])).toBe(t);
  });
});
