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

describeU1('U1 FR-12 columns on Neo4j (K10; BR-U1-28, BR-U1-35)', () => {
  let repo: Neo4jRepository | undefined;
  let tempRoot = '';

  beforeAll(() => {
    const neo4j = neo4jConfig();
    repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u1-fr12-')));
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

  /** A Neo4j integer (the driver returns `Integer` objects) or a JS integer. */
  function isInteger(v: unknown): boolean {
    return neo4jDriver.isInt(v) || Number.isInteger(v);
  }

  async function ingestVariantA(): Promise<void> {
    const variantA = GOLDEN_CASES.find((c) => c.id === 'variant-a-structural');
    if (!variantA || !repo) throw new Error('variant-a case or repository missing');
    const spec = await parseSpec({ specFilePath: variantA.specPath });
    if (!spec.success) throw new Error('golden spec did not parse');
    const apg = await extractAPG(variantA.projectPath);
    if (!apg.success) throw new Error(`extractAPG failed: ${apg.errors.map((e) => e.code).join(', ')}`);
    const store = new FileSystemSnapshotStore(path.join(tempRoot, '.apg-store'));
    const ingested = await ingestAPG({ apgResult: apg.data, layerModel: spec.data.layerModel, mode: 'stateless' }, repo, store);
    if (!ingested.success) throw new Error(`ingestAPG failed: ${ingested.errors.map((e) => e.code).join(', ')}`);
  }

  async function compiled(name: string): Promise<CypherQuery> {
    const q = (await compiledQueries('specs/clean-arch.yaml')).find((c) => c.name === name);
    if (!q) throw new Error(`${name} not compiled from specs/clean-arch.yaml`);
    return q;
  }

  it('every FF-S01 row on ingested variant-a carries a non-null integer line and the FR-12 columns', async () => {
    await ingestVariantA();
    const q = await compiled('dependency-direction');
    const rows = await run(q.cypher, q.params);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect({ source: r.source, lineIsInteger: isInteger(r.line), relType: r.relType, isTypeOnly: typeof r.isTypeOnly })
        .toEqual({ source: r.source, lineIsInteger: true, relType: 'IMPORTS', isTypeOnly: 'boolean' });
      expect(typeof r.target).toBe('string');
    }
  });

  it('every cycle row on ingested variant-a carries target = cycle[1] and an integer line', async () => {
    await ingestVariantA();
    const q = await compiled('no-cyclic-deps');
    const rows = await run(q.cypher, q.params);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const cycle = r.cycle as string[];
      expect({ cycle, target: r.target, lineIsInteger: isInteger(r.line) }).toEqual({ cycle, target: cycle[1], lineIsInteger: true });
    }
  });
});

describeU1('U1 row order on Neo4j (BR-U1-29 b)', () => {
  let repo: Neo4jRepository | undefined;
  let tempRoot = '';

  beforeAll(() => {
    const neo4j = neo4jConfig();
    repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u1-order-')));
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

  /** Neo4j integers and floats to plain JSON, so two executions compare by value. */
  function plain(rows: readonly Record<string, unknown>[]): string {
    return JSON.stringify(rows, (_k, v: unknown) =>
      (typeof v === 'object' && v !== null && 'toNumber' in v && typeof v.toNumber === 'function'
        ? (v as { toNumber: () => number }).toNumber()
        : v));
  }

  it('every compiled golden-spec query returns identical row arrays on two executions (ingested variant-a)', async () => {
    const variantA = GOLDEN_CASES.find((c) => c.id === 'variant-a-structural');
    if (!variantA || !repo) throw new Error('variant-a case or repository missing');
    const spec = await parseSpec({ specFilePath: variantA.specPath });
    if (!spec.success) throw new Error('golden spec did not parse');
    const apg = await extractAPG(variantA.projectPath);
    if (!apg.success) throw new Error(`extractAPG failed: ${apg.errors.map((e) => e.code).join(', ')}`);
    const store = new FileSystemSnapshotStore(path.join(tempRoot, '.apg-store'));
    const ingested = await ingestAPG({ apgResult: apg.data, layerModel: spec.data.layerModel, mode: 'stateless' }, repo, store);
    if (!ingested.success) throw new Error(`ingestAPG failed: ${ingested.errors.map((e) => e.code).join(', ')}`);

    const queries = await compiledQueries('specs/clean-arch.yaml');
    expect(queries.length).toBe(23);
    let withRows = 0;
    for (const q of queries) {
      const first = await run(q.cypher, q.params);
      const second = await run(q.cypher, q.params);
      if (first.length > 0) withRows++;
      expect({ id: String(q.functionId), rows: plain(second) }).toEqual({ id: String(q.functionId), rows: plain(first) });
      if (q.name === 'use-case-isolation') {
        for (const r of first) {
          const list = r.violations as string[];
          expect(list).toEqual([...list].sort());
        }
      }
    }
    expect(withRows).toBeGreaterThan(0);
  });

  it('use-case-isolation returns its violation list sorted', async () => {
    await run(
      "CREATE (uc:Class {name: 'CreateTaskUseCase', layer: 'application', filePath: 'src/application/CreateTaskUseCase.ts'}) " +
      'WITH uc UNWIND $deps AS d ' +
      "CREATE (uc)-[:CONSTRUCTOR_INJECTS]->(:Class {name: d, layer: 'infrastructure', filePath: 'src/infrastructure/' + d + '.ts'})",
      { deps: ['Zed', 'Alpha', 'Mid'] },
    );
    const q = (await compiledQueries('specs/clean-arch.yaml')).find((c) => c.name === 'use-case-isolation');
    if (!q) throw new Error('use-case-isolation not compiled');
    const rows = await run(q.cypher, q.params);
    expect(rows.map((r) => r.violations)).toEqual([['Alpha', 'Mid', 'Zed']]);
  });
});

/** The golden-spec compiler input with `exclude_paths` on every function whose template is in `templates`. */
async function goldenInputWithExcludes(templates: (name: string) => boolean, styleless = false): Promise<ReturnType<typeof compilerInputFromSpec>> {
  const parsed = await parseSpec({ specFilePath: path.join(ROOT, 'specs/clean-arch.yaml') });
  if (!parsed.success) throw new Error('specs/clean-arch.yaml did not parse');
  const input = compilerInputFromSpec(parsed.data);
  const fitnessFunctions = input.fitnessFunctions.map((ff) => (templates(ff.name) ? { ...ff, excludePaths: ['src/x/**'] } : ff));
  if (!styleless) return { ...input, fitnessFunctions };
  const { style: _style, ...rest } = input;
  return { ...rest, fitnessFunctions };
}

describeU1('U1 exclude anchors on Neo4j (BR-U1-32 a, BR-U1-44 b)', () => {
  let repo: Neo4jRepository | undefined;

  beforeAll(() => {
    const neo4j = neo4jConfig();
    repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
  });

  afterEach(async () => {
    await run('MATCH (n) DETACH DELETE n');
  });

  afterAll(async () => {
    if (repo) await repo.close();
  });

  async function run(cypher: string, params?: Record<string, unknown>): Promise<readonly Record<string, unknown>[]> {
    if (!repo) throw new Error('repository not initialised');
    const result = await repo.executeQuery(cypher, params);
    if (!result.success) {
      throw new Error(`Query failed against ${redactUri(neo4jConfig().uri)}: ${result.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
    }
    return result.data.records;
  }

  it('(a) every template compiled with exclude_paths ["src/x/**"] EXPLAINs with no deprecation notification', async () => {
    // Style dropped so FF-S03 (no-layer-skip, layered only) compiles too: all 24 templates are covered.
    const compiled = compileFunctions(await goldenInputWithExcludes((name) => name !== 'abstraction-ratio', true));
    if (!compiled.success) throw new Error(`did not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
    const queries = [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)];
    expect(new Set(queries.map((q) => q.name)).size).toBe(24);

    const neo4j = neo4jConfig();
    const driver = neo4jDriver.driver(neo4j.uri, neo4jDriver.auth.basic(neo4j.user, neo4j.password));
    try {
      for (const q of queries) {
        const session = driver.session();
        try {
          const result = await session.run(`EXPLAIN ${q.cypher}`, q.params, { timeout: 30_000 });
          const deprecations = result.summary.notifications
            .filter((n) => n.category === 'DEPRECATION' || n.code.includes('Deprecat'))
            .map((n) => n.code);
          const predicate = q.name === 'abstraction-ratio' || q.cypher.includes('$excludePatterns');
          expect({ name: q.name, deprecations, predicate }).toEqual({ name: q.name, deprecations: [], predicate: true });
        } finally {
          await session.close();
        }
      }
    } finally {
      await driver.close();
    }
  });

  it('(BR-U1-44 b) an excluded class over maxPublicMethods only yields no FF-SO01 row; without the exclude it yields one', async () => {
    const plainInput = await goldenInputWithExcludes(() => false);
    const plain = compileFunctions(plainInput);
    const excluded = compileFunctions(await goldenInputWithExcludes((name) => name === 'single-responsibility-proxy'));
    if (!plain.success || !excluded.success) throw new Error('did not compile');
    const pick = (qs: readonly CypherQuery[]): CypherQuery => {
      const q = qs.find((c) => c.name === 'single-responsibility-proxy');
      if (!q) throw new Error('single-responsibility-proxy not compiled');
      return q;
    };
    const srpPlain = pick(plain.data.symbolicQueries);
    const srpExcluded = pick(excluded.data.symbolicQueries);
    const maxMethods = Number(srpPlain.params.maxPublicMethods);
    const maxDeps = Number(srpPlain.params.maxDependencies);
    expect(maxDeps).toBeGreaterThanOrEqual(0);

    await run(
      "CREATE (c:Class {name: 'A', filePath: 'src/x/A.ts', layer: 'domain'}) " +
      "WITH c UNWIND range(1, $methods) AS i CREATE (c)-[:CONTAINS]->(:Method {name: 'm' + toString(i)})",
      { methods: neo4jDriver.int(maxMethods + 1) },
    );

    expect((await run(srpPlain.cypher, srpPlain.params)).map((r) => r.filePath)).toEqual(['src/x/A.ts']);
    expect(await run(srpExcluded.cypher, srpExcluded.params)).toEqual([]);
  });
});
