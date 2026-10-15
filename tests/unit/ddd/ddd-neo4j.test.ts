/**
 * DDD reference project against a real Neo4j (v1.3, FR-V3/FR-V4): ingests every variant and runs the compiled
 * Cypher queries themselves, not the TypeScript mirror. Needs a local Neo4j and NEO4J_PASSWORD, resolved by the
 * golden suite's guard (`resolveGoldenEnv`: localhost only unless GOLDEN_ALLOW_WIPE=1, because ingestion wipes the
 * database). Without it the whole suite is skipped, and the reason is printed once.
 *
 * Expected results are the manifests, with the differences recorded in ddd-reference.test.ts (KNOWN_MISMATCHES).
 */
import * as path from 'node:path';
import { Neo4jRepository } from '../../../src/neo4j-ingestion/neo4j-repository.js';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import { ensureIndexes, ingestEdges, ingestNodes } from '../../../src/neo4j-ingestion/graph-ingester.js';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { getExtensionTemplate } from '../../../src/fitness-compiler/extension-templates.js';
import { resolveGoldenEnv } from '../../golden/golden-env.js';
import {
  cleanupScratch, compiledPreset, must, manifestKeys, materialise, parsedPreset, readVariant, REFERENCE, tmpdir, variantIds,
} from './reference-project.js';

jest.setTimeout(300_000);

/** Same recorded differences as the mirror test (the mirror and the Cypher must agree). */
const KNOWN_GOT: Readonly<Record<string, readonly string[]>> = {
  'g01-value-object-setter-accessor': [],
  'g03-deep-import-of-reexported-file': [],
};
/**
 * The v1.3 compile (V13_COMPILE_OPTIONS, as the pipeline runs it): context-isolation reads the literal barrel edge
 * (fix round, fix 6), so g03's deep import is found and M2 is closed; g01 (M3, no accessor facts) stays.
 */
const KNOWN_GOT_V13: Readonly<Record<string, readonly string[]>> = {
  'g01-value-object-setter-accessor': [],
};

const env = resolveGoldenEnv();
const describeNeo4j = env.enabled ? describe : describe.skip;
if (!env.enabled) {
   
  console.info(`ddd-neo4j: skipped (${env.reason})`);
}

describeNeo4j('DDD reference project on Neo4j', () => {
  const parent = tmpdir();
  let repo: Neo4jRepository | undefined;

  beforeAll(() => {
    if (!env.enabled) return;
    repo = new Neo4jRepository({ neo4jUri: env.neo4j.uri, neo4jUser: env.neo4j.user, neo4jPassword: env.neo4j.password });
  });
  afterAll(async () => {
    cleanupScratch(parent);
    await repo?.close();
  });

  it.each([
    ...['clean', ...variantIds()].map((id) => [id, 'frozen compile'] as const),
    ...['clean', ...variantIds()].map((id) => [id, 'v1.3 compile'] as const),
  ])('%s (%s)', async (id, mode) => {
    const known = mode === 'v1.3 compile' ? KNOWN_GOT_V13 : KNOWN_GOT;
    const spec = await parsedPreset();
    const queries = await compiledPreset(mode === 'v1.3 compile' ? V13_COMPILE_OPTIONS : {});
    const dir = id === 'clean' ? path.join(REFERENCE, 'clean') : materialise(id, parent);
    const apg = await extractAPG(dir);
    if (!apg.success) throw new Error(apg.errors.map((e) => e.message).join('; '));
    const { annotations } = annotateNodes(apg.data.nodes, spec.layerModel);

    const db = must(repo, 'Neo4j repository');
    expect((await db.clearGraph()).success).toBe(true);
    expect((await ensureIndexes(db)).success).toBe(true);
    expect((await ingestNodes(apg.data.nodes, annotations, db)).success).toBe(true);
    expect((await ingestEdges(apg.data.edges, db)).success).toBe(true);

    const got = new Set<string>();
    for (const q of queries) {
      const r = await db.executeQuery(q.cypher, { ...q.params });
      if (!r.success) throw new Error(`${String(q.functionId)}: ${r.errors.map((e) => e.message).join('; ')}`);
      const mapping = must(CYPHER_TEMPLATES.get(q.name) ?? getExtensionTemplate(q.name), q.name).resultMapping;
      for (const row of r.data.records) {
        const file = row[mapping.filePathColumn];
        const target = mapping.targetColumn !== undefined ? row[mapping.targetColumn] : undefined;
        if (typeof file !== 'string' || (target != null && typeof target !== 'string')) throw new Error(`${String(q.functionId)}: unexpected row shape`);
        got.add(`${String(q.functionId)} ${file}${typeof target === 'string' ? ` -> ${target}` : ''}`);
      }
    }
    const expected = id === 'clean' ? [] : manifestKeys(readVariant(id).manifest);
    expect([...got].sort()).toEqual(id in known ? [...(known[id] ?? [])].sort() : expected);
  });
});
