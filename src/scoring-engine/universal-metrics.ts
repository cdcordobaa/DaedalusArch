import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { UniversalHealthMetrics } from '../shared/types/evaluation.js';
import { DomainResult } from '../shared/errors/domain-result.js';

/**
 * Compute universal health metrics from Neo4j graph.
 * These are spec-independent and always computed.
 */
export async function computeUniversalMetrics(
  graphRepo: GraphRepository,
): Promise<DomainResult<UniversalHealthMetrics>> {
  const queries = {
    cycles: 'MATCH path = (f:File)-[:IMPORTS*2..]->(f) RETURN count(DISTINCT f) AS cnt LIMIT 1',
    maxFanOut: 'MATCH (f:File)-[:IMPORTS]->(dep:File) WITH f, count(dep) AS fo RETURN max(fo) AS val',
    maxFanIn: 'MATCH (f:File)<-[:IMPORTS]-(dep:File) WITH f, count(dep) AS fi RETURN max(fi) AS val',
    abstractionRatio: `MATCH (n) WHERE n:Class OR n:Interface
      WITH count(CASE WHEN n:Interface THEN 1 END) AS ifaces, count(n) AS total
      WHERE total > 0 RETURN toFloat(ifaces) / total AS val`,
    avgInstability: `MATCH (f:File)
      OPTIONAL MATCH (f)-[:IMPORTS]->(out:File)
      OPTIONAL MATCH (f)<-[:IMPORTS]-(inc:File)
      WITH f, count(DISTINCT out) AS fo, count(DISTINCT inc) AS fi
      WHERE fo + fi > 0
      RETURN avg(toFloat(fo) / (fo + fi)) AS val`,
    orphans: `MATCH (f:File)
      WHERE NOT EXISTS { MATCH (f)-[:IMPORTS]->() }
      AND NOT EXISTS { MATCH ()-[:IMPORTS]->(f) }
      RETURN count(f) AS cnt`,
  };

  const getNum = async (cypher: string, field: string): Promise<number> => {
    const result = await graphRepo.executeQuery(cypher);
    if (!result.success) return 0;
    const record = result.data.records[0];
    return record ? Number(record[field] ?? 0) : 0;
  };

  const [cycles, maxFanOut, maxFanIn, ratio, instability, orphans] = await Promise.all([
    getNum(queries.cycles, 'cnt'),
    getNum(queries.maxFanOut, 'val'),
    getNum(queries.maxFanIn, 'val'),
    getNum(queries.abstractionRatio, 'val'),
    getNum(queries.avgInstability, 'val'),
    getNum(queries.orphans, 'cnt'),
  ]);

  return DomainResult.ok<UniversalHealthMetrics>({
    cyclicDependencyCount: cycles,
    maxFanOut,
    maxFanIn,
    abstractionRatio: Math.round(ratio * 1000) / 1000,
    averageInstability: Math.round(instability * 1000) / 1000,
    orphanFileCount: orphans,
  });
}
