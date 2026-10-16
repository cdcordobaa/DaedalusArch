/**
 * ADR-V13-01 edge views on Neo4j: the rewritten Cypher runs, is a no-op on a v1.2E graph, and on the v1.3 graph of
 * `fixtures/unit/v13-barrels` the literal-view layer rules see the barrel edge (infrastructure -> application) instead
 * of the routed infrastructure -> domain edge. Uses the golden suite's guard (`resolveGoldenEnv`: needs
 * `NEO4J_PASSWORD`, a localhost URI unless `GOLDEN_ALLOW_WIPE=1`) and skips cleanly without it. It wipes the graph.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { V12E_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { computeUniversalMetrics } from '../../../src/scoring-engine/universal-metrics.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { edgeViewOf } from '../../../src/fitness-compiler/edge-views.js';
import { FileSystemSnapshotStore, Neo4jRepository, ingestAPG } from '../../../src/neo4j-ingestion/index.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { resolveGoldenEnv } from '../../golden/golden-env.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURE = path.join(REPO_ROOT, 'fixtures/unit/v13-barrels');
const env = resolveGoldenEnv();
if (!env.enabled) console.warn(`[v13-edge-views-neo4j] skipped: ${env.reason}`);
const describeNeo4j = env.enabled ? describe : describe.skip;

type Rows = Record<string, readonly Record<string, unknown>[]>;

async function specOf(file: string): Promise<ParsedSpec> {
  const parsed = await parseSpec({ specFilePath: path.isAbsolute(file) ? file : path.join(REPO_ROOT, file) });
  if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  return parsed.data;
}

function queriesOf(spec: ParsedSpec, edgeViews: boolean): CypherQuery[] {
  // The edge-view option alone; the fix round's role-token and applicability options are checked separately below.
  const r = compileFunctions(compilerInputFromSpec(spec), edgeViews ? { edgeViews: true } : {});
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return [...r.data.symbolicQueries, ...r.data.hybridPairs.map((h) => h.symbolicQuery)];
}

describeNeo4j('edge views on Neo4j (ADR-V13-01)', () => {
  let repo: Neo4jRepository;
  let store: string;
  let spec: ParsedSpec;
  let clean: ParsedSpec;

  beforeAll(async () => {
    if (!env.enabled) return;
    repo = new Neo4jRepository({ neo4jUri: env.neo4j.uri, neo4jUser: env.neo4j.user, neo4jPassword: env.neo4j.password });
    store = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-edge-views-'));
    // presets/layered.yaml (closed layering, so no-layer-skip applies) with its three layers moved onto the fixture's
    // folders: persistence = src/domain, business = src/application, presentation = src/infrastructure.
    const layered = fs.readFileSync(path.join(REPO_ROOT, 'presets/layered.yaml'), 'utf8')
      .replace('src/persistence/**', 'src/domain/**').replace('src/business/**', 'src/application/**')
      .replace('src/presentation/**', 'src/infrastructure/**');
    const layeredPath = path.join(store, 'layered-on-fixture.yaml');
    fs.writeFileSync(layeredPath, layered);
    spec = await specOf(layeredPath);
    clean = await specOf('specs/clean-arch.yaml');
  });

  afterAll(async () => {
    await repo?.close();
    if (store) fs.rmSync(store, { recursive: true, force: true });
  });

  async function ingest(options: object, layerSpec: ParsedSpec): Promise<void> {
    const apg = await extractAPG(FIXTURE, options);
    if (!apg.success) throw new Error('extractAPG failed');
    const r = await ingestAPG({ apgResult: apg.data, layerModel: layerSpec.layerModel, mode: 'stateless' }, repo, new FileSystemSnapshotStore(store));
    if (!r.success) throw new Error(`ingestAPG failed: ${r.errors.map((e) => e.code).join(', ')}`);
  }

  async function runAll(queries: readonly CypherQuery[]): Promise<Rows> {
    const out: Rows = {};
    for (const q of queries) {
      const r = await repo.executeQuery(q.cypher, q.params);
      if (!r.success) throw new Error(`${q.name}: ${r.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
      out[q.name] = r.data.records;
    }
    return JSON.parse(JSON.stringify(out, (_k, v: unknown) => (typeof v === 'bigint' ? Number(v) : v))) as Rows;
  }

  const pairs = (rows: readonly Record<string, unknown>[] | undefined): string[] =>
    (rows ?? []).map((r) => `${String(r.source)} -> ${String(r.target)}`);

  let v12eFrozen: Rows;
  let v12eViews: Rows;
  let v13Views: Rows;
  let cleanV12eFrozen: Rows;
  let cleanV12eViews: Rows;
  let cleanV13Views: Rows;

  it('runs every compiled query, frozen and rewritten, on the v1.2E graph and the v1.3 graph', async () => {
    await ingest(V12E_DEFAULT_OPTIONS, spec);
    v12eFrozen = await runAll(queriesOf(spec, false));
    v12eViews = await runAll(queriesOf(spec, true));
    await ingest({}, spec);
    v13Views = await runAll(queriesOf(spec, true));
    await ingest(V12E_DEFAULT_OPTIONS, clean);
    cleanV12eFrozen = await runAll(queriesOf(clean, false));
    cleanV12eViews = await runAll(queriesOf(clean, true));
    await ingest({}, clean);
    cleanV13Views = await runAll(queriesOf(clean, true));
    // Hexagonal templates: syntax check of the rewritten text on the same graph.
    const hex = await specOf('presets/hexagonal.yaml');
    for (const q of queriesOf(hex, true)) {
      const r = await repo.executeQuery(`EXPLAIN ${q.cypher}`, q.params);
      expect([q.name, r.success]).toEqual([q.name, true]);
    }
  }, 240_000);

  it('on a v1.2E graph the rewrite changes no row (every template, both specs)', () => {
    expect(Object.keys(v12eFrozen).length).toBeGreaterThan(10);
    expect(v12eViews).toEqual(v12eFrozen);
    expect(cleanV12eViews).toEqual(cleanV12eFrozen);
  });

  it('resolved-view templates give the v1.2E rows on the v1.3 graph', () => {
    for (const [frozen, v13] of [[v12eFrozen, v13Views], [cleanV12eFrozen, cleanV13Views]] as const) {
      for (const name of Object.keys(frozen).filter((n) => edgeViewOf(n) === 'resolved')) {
        expect([name, v13[name]]).toEqual([name, frozen[name]]);
      }
    }
  });

  it('no-cyclic-deps (literal) finds the export * cycle in both graphs', () => {
    expect(v13Views['no-cyclic-deps']?.map((r) => r.cycle)).toEqual(v12eFrozen['no-cyclic-deps']?.map((r) => r.cycle));
    expect(cleanV13Views['no-cyclic-deps']?.map((r) => r.cycle)).toContainEqual(['src/cycle/a.ts', 'src/cycle/b.ts', 'src/cycle/a.ts']);
  });

  it('no-layer-skip: the order-fulfilment import is infrastructure -> application (allowed) in v1.3, a skip to domain in v1.2E', () => {
    const repoFile = 'src/infrastructure/persistence/InMemoryOrderRepository.ts';
    const v12e = pairs(v12eFrozen['no-layer-skip']).filter((p) => p.startsWith(repoFile));
    const v13 = pairs(v13Views['no-layer-skip']).filter((p) => p.startsWith(repoFile));
    expect(v12e).toEqual([
      `${repoFile} -> src/domain/entities/Order.ts`,
      `${repoFile} -> src/domain/repositories/OrderRepository.ts`,
      `${repoFile} -> src/domain/value-objects/OrderStatus.ts`,
    ]);
    expect(v13).toEqual([]);
    // A direct deep import of the domain is a skip in both.
    const direct = 'src/infrastructure/directAndBarrel.ts -> src/domain/entities/Order.ts';
    expect(pairs(v12eFrozen['no-layer-skip'])).toContain(direct);
    expect(pairs(v13Views['no-layer-skip'])).toContain(direct);
    // Importing the domain barrel directly is still a skip, now to the barrel file.
    expect(pairs(v13Views['no-layer-skip'])).toContain('src/infrastructure/star.ts -> src/domain/index.ts');
  });

  it('fix round: the literal universal metrics run, equal the frozen ones on the v1.2E graph, and drop the resolved edges on v1.3', async () => {
    await ingest(V12E_DEFAULT_OPTIONS, clean);
    const frozen12 = await computeUniversalMetrics(repo, 'cypher');
    const literal12 = await computeUniversalMetrics(repo, 'cypher', undefined, undefined, 'literal');
    await ingest({}, clean);
    const literal13 = await computeUniversalMetrics(repo, 'cypher', undefined, undefined, 'literal');
    const frozen13 = await computeUniversalMetrics(repo, 'cypher');
    for (const r of [frozen12, literal12, literal13, frozen13]) {
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.warnings.filter((w) => w.code === 'METRIC_001')).toEqual([]);
    }
    if (!frozen12.success || !literal12.success || !literal13.success || !frozen13.success) return;
    expect(literal12.data.metrics).toEqual(frozen12.data.metrics);
    // On the v1.3 graph the frozen queries count both edges of every barrel import; the literal ones do not.
    expect(literal13.data.metrics.maxFanOut).toBeLessThanOrEqual(frozen13.data.metrics.maxFanOut ?? Infinity);
  }, 120_000);

  it('fix round: the V13_COMPILE_OPTIONS queries (role tokens, applicability, views) all run on the v1.3 graph', async () => {
    await ingest({}, clean);
    for (const s of [clean, spec, await specOf('presets/clean-architecture.yaml'), await specOf('presets/nestjs.yaml'), await specOf('presets/hexagonal.yaml')]) {
      const r = compileFunctions(compilerInputFromSpec(s), V13_COMPILE_OPTIONS);
      if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
      for (const q of r.data.symbolicQueries) {
        const res = await repo.executeQuery(q.cypher, q.params);
        expect([q.name, res.success]).toEqual([q.name, true]);
      }
    }
  }, 120_000);
});
