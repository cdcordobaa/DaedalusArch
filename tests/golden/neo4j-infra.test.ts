/**
 * FR-01 automated: the local Neo4j answers a smoke query and APOC is loaded.
 * Same skip and host guards as golden.test.ts (see golden-env.ts).
 * (The NFR-07 timeout case is appended in U0 Step 25.)
 */
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { redactUri, resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';

const goldenEnv = resolveGoldenEnv();

if (!goldenEnv.enabled) {
  console.warn(`[neo4j-infra] ${goldenEnv.reason}`);
}

const describeInfra = goldenEnv.enabled ? describe : describe.skip;

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

describeInfra('Neo4j infrastructure (FR-01)', () => {
  let repo: Neo4jRepository | undefined;

  beforeAll(() => {
    const neo4j = neo4jConfig();
    repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
  });

  afterAll(async () => {
    if (repo) await repo.close();
  });

  it('answers MATCH (n) RETURN count(n)', async () => {
    const result = await repo!.executeQuery('MATCH (n) RETURN count(n) AS cnt');
    if (!result.success) {
      throw new Error(`Smoke query failed against ${redactUri(neo4jConfig().uri)}: ${result.errors.map((e) => e.code).join(', ')}`);
    }
    expect(result.data.records).toHaveLength(1);
    expect(Number(result.data.records[0]?.['cnt'])).toBeGreaterThanOrEqual(0);
  });

  it('has APOC: apoc.coll.indexOf([1,2],2) returns 1', async () => {
    const result = await repo!.executeQuery('RETURN apoc.coll.indexOf([1,2],2) AS idx');
    if (!result.success) {
      throw new Error(`APOC call failed against ${redactUri(neo4jConfig().uri)}: ${result.errors.map((e) => e.code).join(', ')}`);
    }
    expect(Number(result.data.records[0]?.['idx'])).toBe(1);
  });
});
