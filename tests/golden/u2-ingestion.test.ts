/**
 * U2 gated Neo4j acceptance (S-5a): FR-09 Package label and indexes
 * (BR-U2-33), FR-10 IMPORTS properties read back (BR-U2-32), interface
 * CONTAINS on variant-b (ADR-016 f, BR-U2-47 c) and extract + ingest latency
 * per golden fixture (NFR-03, BR-U2-46).
 * Same skip and host guards as neo4j-infra.test.ts (see golden-env.ts).
 * Writes no snapshot; every ingestion wipes the database (run under the
 * golden lock locally).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { FileSystemSnapshotStore, Neo4jRepository, ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import { GOLDEN_CASES } from './golden-cases.js';
import { redactUri, resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';

const goldenEnv = resolveGoldenEnv();

if (!goldenEnv.enabled) {
  console.warn(`[u2-ingestion] ${goldenEnv.reason}`);
}

const describeU2 = goldenEnv.enabled ? describe : describe.skip;

/** NFR-03 (BR-U2-46): extract + ingest per fixture stays below this bound. */
const LATENCY_LIMIT_MS = 5000;

const FPKG_LAYER_MODEL: LayerModel = {
  layers: [{ name: 'domain', directories: ['src/domain'], naming: [], role: 'domain' }],
};

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

/** One record cell; Neo4j integers are converted by the caller with Number(). */
function cell(record: Record<string, unknown> | undefined, key: string): unknown {
  return record?.[key];
}

function writeFile(root: string, rel: string, text: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

/** F-PKG: one bare import of an absent package and one side-effect relative import. */
function createFpkgProject(root: string): void {
  writeFile(root, 'tsconfig.json', '{"compilerOptions":{"module":"CommonJS","moduleResolution":"node"},"include":["src/**/*.ts"]}');
  writeFile(root, 'src/domain/x.ts', "import express from 'express';\nimport './y';\nexport const x = express;");
  writeFile(root, 'src/domain/y.ts', 'export {};');
}

describeU2('U2 ingestion acceptance (FR-09, FR-10, NFR-03, ADR-016 f)', () => {
  let repo: Neo4jRepository | undefined;
  let tempRoot = '';
  let fpkgDir = '';
  let fixtureLayerModel: LayerModel | undefined;

  beforeAll(async () => {
    const neo4j = neo4jConfig();
    repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u2-fpkg-')));
    fpkgDir = path.join(tempRoot, 'project');
    createFpkgProject(fpkgDir);
    const specPath = GOLDEN_CASES[0]?.specPath;
    if (specPath === undefined) throw new Error('no golden case');
    const spec = await parseSpec({ specFilePath: specPath });
    if (!spec.success) throw new Error(`spec parse failed: ${spec.errors.map((e) => e.code).join(', ')}`);
    fixtureLayerModel = spec.data.layerModel;
  });

  afterAll(async () => {
    if (repo) await repo.close();
    if (tempRoot !== '') fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function requireRepo(): Neo4jRepository {
    if (!repo) throw new Error('repository not initialised');
    return repo;
  }

  function store(): FileSystemSnapshotStore {
    return new FileSystemSnapshotStore(path.join(tempRoot, '.apg-store'));
  }

  async function query(cypher: string): Promise<readonly Record<string, unknown>[]> {
    const result = await requireRepo().executeQuery(cypher);
    if (!result.success) {
      throw new Error(`Query failed against ${redactUri(neo4jConfig().uri)}: ${result.errors.map((e) => e.code).join(', ')}`);
    }
    return result.data.records;
  }

  async function extractAndIngest(projectPath: string, layerModel: LayerModel): Promise<{ extractMs: number; ingestMs: number }> {
    const t0 = performance.now();
    const apg = await extractAPG(projectPath);
    const t1 = performance.now();
    if (!apg.success) throw new Error(`extractAPG failed: ${apg.errors.map((e) => e.code).join(', ')}`);
    const ingested = await ingestAPG({ apgResult: apg.data, layerModel, mode: 'stateless' }, requireRepo(), store());
    const t2 = performance.now();
    if (!ingested.success) throw new Error(`ingestAPG failed: ${ingested.errors.map((e) => e.code).join(', ')}`);
    return { extractMs: t1 - t0, ingestMs: t2 - t1 };
  }

  it('(1) F-PKG: indexes online, one Package express, File -[:IMPORTS]-> Package', async () => {
    await extractAndIngest(fpkgDir, FPKG_LAYER_MODEL);

    const indexes = await query(
      "SHOW INDEXES YIELD name, state WHERE name IN ['apg_node_id', 'package_id'] RETURN name, state ORDER BY name",
    );
    expect(indexes.map((r) => [cell(r, 'name'), cell(r, 'state')])).toEqual([
      ['apg_node_id', 'ONLINE'],
      ['package_id', 'ONLINE'],
    ]);

    const packages = await query("MATCH (p:Package {name: 'express'}) RETURN count(p) AS cnt");
    expect(Number(cell(packages[0], 'cnt'))).toBe(1);

    const edges = await query(
      "MATCH (f:File)-[i:IMPORTS]->(p:Package {name: 'express'}) WHERE f.filePath ENDS WITH 'src/domain/x.ts' RETURN count(i) AS cnt",
    );
    expect(Number(cell(edges[0], 'cnt'))).toBe(1);
  });

  it('(2) ingesting F-PKG twice does not fail', async () => {
    await extractAndIngest(fpkgDir, FPKG_LAYER_MODEL);
    await extractAndIngest(fpkgDir, FPKG_LAYER_MODEL);
    const packages = await query("MATCH (p:Package {name: 'express'}) RETURN count(p) AS cnt");
    expect(Number(cell(packages[0], 'cnt'))).toBe(1);
  });

  it('(3) IMPORTS properties read back on the F-PKG graph', async () => {
    await extractAndIngest(fpkgDir, FPKG_LAYER_MODEL);
    const rows = await query(
      'MATCH (f:File)-[i:IMPORTS]->(t) ' +
      "WHERE f.filePath ENDS WITH 'src/domain/x.ts' " +
      'RETURN CASE WHEN t:Package THEN t.name ELSE t.filePath END AS target, labels(t) AS labels, ' +
      'i.line AS line, i.lines AS lines, i.isTypeOnly AS isTypeOnly, i.specifier AS specifier, i.importedNames AS importedNames ' +
      'ORDER BY line',
    );
    const projected = rows.map((r) => ({
      target: String(cell(r, 'target')).endsWith('src/domain/y.ts') ? 'y.ts' : String(cell(r, 'target')),
      isPackage: (cell(r, 'labels') as string[]).includes('Package'),
      line: Number(cell(r, 'line')),
      lines: (cell(r, 'lines') as unknown[]).map(Number),
      isTypeOnly: cell(r, 'isTypeOnly'),
      specifier: cell(r, 'specifier'),
      importedNames: cell(r, 'importedNames'),
    }));
    expect(projected).toEqual([
      { target: 'express', isPackage: true, line: 1, lines: [1], isTypeOnly: false, specifier: 'express', importedNames: ['default'] },
      { target: 'y.ts', isPackage: false, line: 2, lines: [2], isTypeOnly: false, specifier: './y', importedNames: [] },
    ]);
  });

  it('(4) variant-b: ITaskRepository CONTAINS 8 Method nodes', async () => {
    const variantB = GOLDEN_CASES.find((c) => c.id === 'variant-b-pattern');
    if (!variantB || !fixtureLayerModel) throw new Error('variant-b case or layer model missing');
    await extractAndIngest(variantB.projectPath, fixtureLayerModel);
    const rows = await query("MATCH (i:Interface {name: 'ITaskRepository'})-[:CONTAINS]->(m:Method) RETURN count(m) AS cnt");
    expect(Number(cell(rows[0], 'cnt'))).toBe(8);
  });

  it.each(GOLDEN_CASES.map((c) => [c.id, c.projectPath] as const))(
    '(5) %s: extract + ingest below 5 000 ms (NFR-03)',
    async (id, projectPath) => {
      if (!fixtureLayerModel) throw new Error('layer model missing');
      const { extractMs, ingestMs } = await extractAndIngest(projectPath, fixtureLayerModel);
      const total = extractMs + ingestMs;
      console.info(
        `[u2-ingestion] ${id}: extract ${extractMs.toFixed(0)} ms, ingest ${ingestMs.toFixed(0)} ms, total ${total.toFixed(0)} ms`,
      );
      expect(total).toBeLessThan(LATENCY_LIMIT_MS);
    },
  );
});
