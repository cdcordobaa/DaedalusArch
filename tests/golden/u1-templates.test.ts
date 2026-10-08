/**
 * U1 container tests (D-U1-4): compiled templates and parameters against the real Neo4j 5.26.
 * Same skip and host guards as golden.test.ts and neo4j-infra.test.ts (see golden-env.ts).
 * A describe that needs a graph seeds it in beforeEach and wipes it in afterEach.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import neo4jDriver from 'neo4j-driver';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { FileSystemSnapshotStore, ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { CYCLE_ROW_CAP } from '../../src/fitness-compiler/cypher-templates.js';
import type { CypherQuery } from '../../src/shared/types/evaluation.js';
import { GOLDEN_CASES } from './golden-cases.js';
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

/** Every compiled symbolic query (hybrid included) of one spec, in compiled order. */
async function compiledQueries(rel: string): Promise<CypherQuery[]> {
  const parsed = await parseSpec({ specFilePath: path.join(ROOT, rel) });
  if (!parsed.success) throw new Error(`${rel} did not parse`);
  const compiled = compileFunctions(compilerInputFromSpec(parsed.data));
  if (!compiled.success) throw new Error(`${rel} did not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  return [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)];
}

/** The compiled FF-S02 cycle query of the golden spec. */
async function compiledCycleQuery(): Promise<CypherQuery> {
  const q = (await compiledQueries('specs/clean-arch.yaml')).find((c) => c.name === 'no-cyclic-deps');
  if (!q) throw new Error('no-cyclic-deps not compiled from specs/clean-arch.yaml');
  return q;
}

describeU1('U1 cycle query on Neo4j (BR-U1-28 a, b; BR-U1-31)', () => {
  let repo: Neo4jRepository | undefined;
  let tempRoot = '';

  beforeAll(() => {
    const neo4j = neo4jConfig();
    repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u1-cycle-')));
  });

  afterEach(async () => {
    await run('MATCH (n) DETACH DELETE n');
  });

  afterAll(async () => {
    if (repo) await repo.close();
    if (tempRoot !== '') fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  async function run(cypher: string, params?: Record<string, unknown>): Promise<readonly Record<string, unknown>[]> {
    if (!repo) throw new Error('repository not initialised');
    const result = await repo.executeQuery(cypher, params);
    if (!result.success) {
      throw new Error(`Query failed against ${redactUri(neo4jConfig().uri)}: ${result.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
    }
    return result.data.records;
  }

  /** Seeds `:File` nodes for every path in `edges` and one IMPORTS edge per pair. */
  async function seed(edges: readonly (readonly [string, string])[]): Promise<void> {
    await run(
      'UNWIND $edges AS e MERGE (a:File {filePath: e[0]}) MERGE (b:File {filePath: e[1]}) CREATE (a)-[:IMPORTS]->(b)',
      { edges: edges.map(([a, b]) => [a, b]) },
    );
  }

  async function cycles(): Promise<string[][]> {
    const q = await compiledCycleQuery();
    const rows = await run(q.cypher, q.params);
    return rows.map((r) => r.cycle as string[]);
  }

  it('(a) EXPLAIN of the compiled cycle query succeeds', async () => {
    const q = await compiledCycleQuery();
    await expect(run(`EXPLAIN ${q.cypher}`, q.params)).resolves.toBeDefined();
  });

  it('(b) a 2-cycle A<->B yields exactly one row [A, B, A]', async () => {
    await seed([['src/B.ts', 'src/A.ts'], ['src/A.ts', 'src/B.ts']]);
    expect(await cycles()).toEqual([['src/A.ts', 'src/B.ts', 'src/A.ts']]);
  });

  it('(b) a 3-cycle yields one row starting at the smallest path', async () => {
    await seed([['src/c.ts', 'src/a.ts'], ['src/a.ts', 'src/b.ts'], ['src/b.ts', 'src/c.ts']]);
    expect(await cycles()).toEqual([['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts']]);
  });

  it('(b) a cycle of length 11 yields no row (MAX_CYCLE_LENGTH = 10)', async () => {
    const files = Array.from({ length: 11 }, (_, i) => `src/n${String(i).padStart(2, '0')}.ts`);
    await seed(files.map((f, i) => [f, files[(i + 1) % files.length] ?? f] as const));
    expect(await cycles()).toEqual([]);
  });

  it('(b) 102 disjoint 2-cycles yield 101 rows (CYCLE_ROW_CAP + 1 sentinel)', async () => {
    const edges: (readonly [string, string])[] = [];
    for (let i = 0; i < 102; i++) {
      const a = `src/p${String(i).padStart(3, '0')}a.ts`;
      const b = `src/p${String(i).padStart(3, '0')}b.ts`;
      edges.push([a, b], [b, a]);
    }
    await seed(edges);
    const rows = await cycles();
    expect(rows).toHaveLength(CYCLE_ROW_CAP + 1);
    expect(rows[0]).toEqual(['src/p000a.ts', 'src/p000b.ts', 'src/p000a.ts']);
  });

  it('(BR-U1-31) logs resultAvailableAfter of the cycle query on ingested variant-a', async () => {
    const variantA = GOLDEN_CASES.find((c) => c.id === 'variant-a-structural');
    if (!variantA || !repo) throw new Error('variant-a case or repository missing');
    const spec = await parseSpec({ specFilePath: variantA.specPath });
    if (!spec.success) throw new Error('golden spec did not parse');
    const apg = await extractAPG(variantA.projectPath);
    if (!apg.success) throw new Error(`extractAPG failed: ${apg.errors.map((e) => e.code).join(', ')}`);
    const store = new FileSystemSnapshotStore(path.join(tempRoot, '.apg-store'));
    const ingested = await ingestAPG({ apgResult: apg.data, layerModel: spec.data.layerModel, mode: 'stateless' }, repo, store);
    if (!ingested.success) throw new Error(`ingestAPG failed: ${ingested.errors.map((e) => e.code).join(', ')}`);

    const q = await compiledCycleQuery();
    const neo4j = neo4jConfig();
    const driver = neo4jDriver.driver(neo4j.uri, neo4jDriver.auth.basic(neo4j.user, neo4j.password));
    try {
      const session = driver.session();
      try {
        const result = await session.run(q.cypher, q.params, { timeout: 30_000 });
        const after = Number(result.summary.resultAvailableAfter);
        console.info(`[u1-templates] variant-a cycle query: ${String(result.records.length)} rows, resultAvailableAfter ${String(after)} ms (NFR-07 budget 30 000 ms)`);
        expect(result.records.length).toBeLessThanOrEqual(CYCLE_ROW_CAP + 1);
        expect(after).toBeLessThan(30_000);
      } finally {
        await session.close();
      }
    } finally {
      await driver.close();
    }
  });
});
