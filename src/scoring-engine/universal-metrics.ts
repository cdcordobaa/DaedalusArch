/**
 * Universal health metrics (C8; FR-09, FR-34, NFR-07; U3 BR-U3-40..42, 45; domain-entities.md §5).
 *
 * Six spec-independent queries over the graph: a bounded cycle count over `IMPORTS|RE_EXPORTS`
 * (`*2..MAX_CYCLE_LENGTH`), IMPORTS-only `:File`-typed fan-out, fan-in and instability (ADR-015
 * item 8), the abstraction ratio, and the U2 §10 orphan predicate verbatim (no layer filter, ADR-016 g).
 * A failed query sets its metric to `null` with one scrubbed `METRIC_001 {metric, code}`; an undefined
 * ratio is `null` with one `METRIC_002 {metric, reason}`; `null` never appears without one of them.
 */
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { UniversalHealthMetrics } from '../shared/types/evaluation.js';
import type { APGResult } from '../shared/types/apg.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { scrubWarning } from '../shared/errors/scrub.js';
import { MAX_CYCLE_LENGTH } from '../fitness-compiler/cypher-templates.js';
import { CYCLE_STRATEGY, countSccFiles } from '../evaluation-engine/scc-cycles.js';
import type { CycleStrategy } from '../evaluation-engine/scc-cycles.js';

export type UniversalMetric = keyof UniversalHealthMetrics;

export interface UniversalMetricsOutput {
  readonly metrics: UniversalHealthMetrics;
  readonly warnings: readonly DomainWarning[];   // METRIC_001 (failure), METRIC_002 (undefined ratio)
}

/** `METRIC_002` reasons (BR-U3-42, BR-U3-70 item 2). */
export const NO_CLASSES_OR_INTERFACES = 'no classes or interfaces';
export const NO_FILE_TO_FILE_IMPORTS = 'no file-to-file imports';

/** Code of the cycle metric's `METRIC_001` when the SCC strategy has no APG (BR-U3-45). */
export const APG_MISSING = 'APG_MISSING';

/** The six metric queries (BR-U3-40); every one runs with the repository default timeout. */
export const UNIVERSAL_METRIC_QUERIES = {
  cyclicDependencyCount: `MATCH (f:File) WHERE EXISTS { (f)-[:IMPORTS|RE_EXPORTS*2..${String(MAX_CYCLE_LENGTH)}]->(f) } RETURN count(f) AS cnt`,
  maxFanOut: 'MATCH (f:File)-[:IMPORTS]->(dep:File) WITH f, count(dep) AS fo RETURN max(fo) AS val',
  maxFanIn: 'MATCH (f:File)<-[:IMPORTS]-(dep:File) WITH f, count(dep) AS fi RETURN max(fi) AS val',
  abstractionRatio: `MATCH (n) WHERE n:Class OR n:Interface
      WITH count(CASE WHEN n:Interface THEN 1 END) AS ifaces, count(n) AS total
      WHERE total > 0 RETURN toFloat(ifaces) / total AS val`,
  averageInstability: `MATCH (f:File)
      OPTIONAL MATCH (f)-[:IMPORTS]->(out:File)
      OPTIONAL MATCH (f)<-[:IMPORTS]-(inc:File)
      WITH f, count(DISTINCT out) AS fo, count(DISTINCT inc) AS fi
      WHERE fo + fi > 0
      RETURN avg(toFloat(fo) / (fo + fi)) AS val`,
  orphanFileCount: `MATCH (f:File)
WHERE NOT EXISTS { MATCH (f)-[:IMPORTS|RE_EXPORTS]->(:File) }
  AND NOT EXISTS { MATCH (:File)-[:IMPORTS|RE_EXPORTS]->(f) }
  AND NOT f.isBarrel
RETURN count(f) AS cnt`,
} as const satisfies Record<UniversalMetric, string>;

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

type Cell = { readonly kind: 'value'; readonly value: number | null } | { readonly kind: 'failed'; readonly code: string };

/**
 * Compute the universal health metrics. Never fails: a failed metric is `null` plus `METRIC_001`.
 * `strategy` selects the cycle metric's path (`CYCLE_STRATEGY`, default `'cypher'`); `'scc'` reads `apg`.
 */
export async function computeUniversalMetrics(
  graphRepo: GraphRepository,
  strategy: CycleStrategy = CYCLE_STRATEGY,
  apg?: Pick<APGResult, 'nodes' | 'edges'>,
): Promise<DomainResult<UniversalMetricsOutput>> {
  const first = async (metric: UniversalMetric, field: string): Promise<Cell> => {
    const result = await graphRepo.executeQuery(UNIVERSAL_METRIC_QUERIES[metric]);
    if (!result.success) return { kind: 'failed', code: result.errors[0]?.code ?? 'UNKNOWN' };
    const raw = result.data.records[0]?.[field];
    return { kind: 'value', value: raw === null || raw === undefined ? null : Number(raw) };
  };

  const cycles = async (): Promise<Cell> => {
    if (strategy === 'scc') {
      return apg === undefined ? { kind: 'failed', code: APG_MISSING } : { kind: 'value', value: countSccFiles(apg) };
    }
    return first('cyclicDependencyCount', 'cnt');
  };

  const [cyc, fanOut, fanIn, ratio, instability, orphans] = await Promise.all([
    cycles(),
    first('maxFanOut', 'val'),
    first('maxFanIn', 'val'),
    first('abstractionRatio', 'val'),
    first('averageInstability', 'val'),
    first('orphanFileCount', 'cnt'),
  ]);

  const warnings: DomainWarning[] = [];
  const failed = (metric: UniversalMetric, code: string): null => {
    warnings.push(scrubWarning({
      code: 'METRIC_001',
      message: `Universal metric ${metric} could not be computed (${code}); reported as null`,
      context: { metric, code },
    }, []));
    return null;
  };
  const undefinedRatio = (metric: UniversalMetric, reason: string): null => {
    warnings.push({ code: 'METRIC_002', message: `Universal metric ${metric} is undefined: ${reason}`, context: { metric, reason } });
    return null;
  };

  /** Counts and maxima: an empty result or NULL is 0 (BR-U3-42). */
  const count = (metric: UniversalMetric, cell: Cell): number | null =>
    cell.kind === 'failed' ? failed(metric, cell.code) : cell.value ?? 0;
  /** Ratios: no row or NULL is undefined (`null` + `METRIC_002`), else rounded to three decimals. */
  const ratioOf = (metric: UniversalMetric, cell: Cell, reason: string): number | null => {
    if (cell.kind === 'failed') return failed(metric, cell.code);
    return cell.value === null || Number.isNaN(cell.value) ? undefinedRatio(metric, reason) : round3(cell.value);
  };

  const metrics: UniversalHealthMetrics = {
    cyclicDependencyCount: count('cyclicDependencyCount', cyc),
    maxFanOut: count('maxFanOut', fanOut),
    maxFanIn: count('maxFanIn', fanIn),
    abstractionRatio: ratioOf('abstractionRatio', ratio, NO_CLASSES_OR_INTERFACES),
    averageInstability: ratioOf('averageInstability', instability, NO_FILE_TO_FILE_IMPORTS),
    orphanFileCount: count('orphanFileCount', orphans),
  };
  return DomainResult.ok({ metrics, warnings });
}
