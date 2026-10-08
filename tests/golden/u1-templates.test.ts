/**
 * U1 container tests (D-U1-4): compiled templates and parameters against the real Neo4j 5.26.
 * Same skip and host guards as golden.test.ts and neo4j-infra.test.ts (see golden-env.ts).
 * A describe that needs a graph seeds it in beforeEach and wipes it in afterEach.
 */
import * as path from 'node:path';
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { compileFunctions } from '../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import { redactUri, resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';

const goldenEnv = resolveGoldenEnv();

if (!goldenEnv.enabled) {
  console.warn(`[u1-templates] ${goldenEnv.reason}`);
}

const describeU1 = goldenEnv.enabled ? describe : describe.skip;

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

const ROOT = path.resolve(__dirname, '../..');
const SHIPPED = ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'specs/daedalus-arch.yaml', 'specs/clean-arch.yaml'];

/** Every compiled `pattern` parameter of the four shipped specs, with its source. */
async function shippedPatterns(): Promise<{ source: string; pattern: string }[]> {
  const out: { source: string; pattern: string }[] = [];
  for (const rel of SHIPPED) {
    const parsed = await parseSpec({ specFilePath: path.join(ROOT, rel) });
    if (!parsed.success) throw new Error(`${rel} did not parse`);
    const compiled = compileFunctions(compilerInputFromSpec(parsed.data));
    if (!compiled.success) throw new Error(`${rel} did not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
    const queries = [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)];
    for (const q of queries) {
      const p = q.params.pattern;
      if (typeof p === 'string') out.push({ source: `${rel} ${String(q.functionId)}`, pattern: p });
    }
  }
  return out;
}

describeU1('U1 compiled patterns on Neo4j (BR-U1-06 c)', () => {
  let repo: Neo4jRepository | undefined;

  beforeAll(() => {
    const neo4j = neo4jConfig();
    repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
  });

  afterAll(async () => {
    if (repo) await repo.close();
  });

  async function matches(name: string, pattern: string): Promise<boolean> {
    if (!repo) throw new Error('repository not initialised');
    const result = await repo.executeQuery('RETURN $name =~ $pattern AS m', { name, pattern });
    if (!result.success) {
      throw new Error(`=~ failed against ${redactUri(neo4jConfig().uri)} for ${pattern}: ${result.errors.map((e) => e.code).join(', ')}`);
    }
    return result.data.records[0]?.m === true;
  }

  it('every compiled shipped pattern is accepted by =~ (no Invalid Regex)', async () => {
    const patterns = await shippedPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    for (const { source, pattern } of patterns) {
      expect({ source, ok: typeof (await matches('TaskService', pattern)) === 'boolean' }).toEqual({ source, ok: true });
    }
  });

  it("'InMemoryTaskRepository' =~ '^(?:[^/]*Repository|[^/]*Repo)$' is true", async () => {
    expect(await matches('InMemoryTaskRepository', '^(?:[^/]*Repository|[^/]*Repo)$')).toBe(true);
  });
});
