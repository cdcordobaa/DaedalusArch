/**
 * FF-DT03 value-object-immutability over the v1.3 class-member facts (`DDD_MEMBER_FACT_TEMPLATES`,
 * `CompileOptions.memberFacts`). The preset is compiled; its FF-DT03 query is checked as text, evaluated by a
 * TypeScript mirror of its WHERE/WITH over the extracted fixture `fixtures/unit/v13-member-facts`, and, when a
 * local Neo4j is available, run as Cypher on the ingested fixture. Without NEO4J_PASSWORD the Neo4j block is skipped
 * (resolveGoldenEnv) and the reason is printed once.
 *
 * Definition (Evans 2003, ch. 5; aidlc-docs/construction/v1.3-member-facts/notes.md): a value object is mutable when
 * it has a public non-readonly non-static field, a non-static set accessor, or a public non-static method that
 * assigns a this.<field>.
 */
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import { DDD_MEMBER_FACT_TEMPLATES, DDD_TEMPLATES } from '../../../src/fitness-compiler/ddd-templates.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { Neo4jRepository } from '../../../src/neo4j-ingestion/neo4j-repository.js';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import { ensureIndexes, ingestEdges, ingestNodes } from '../../../src/neo4j-ingestion/graph-ingester.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import { resolveGoldenEnv } from '../../golden/golden-env.js';
import { compiledPreset, must, parsedPreset, ROOT } from './reference-project.js';

jest.setTimeout(120_000);

const FIXTURE = path.join(ROOT, 'fixtures/unit/v13-member-facts');

/** `file: method`, one row per mutable value object, as the template returns them. */
const EXPECTED = [
  'src/value-objects/Counter.ts: Counter.count (public mutable field)',
  'src/value-objects/Quantity.ts: Quantity.value (set accessor)',
  'src/value-objects/Range.ts: Range.widen (mutator method), Range.swap (mutator method), Range.bump (mutator method)',
];

async function dt03(options: Parameters<typeof compiledPreset>[0]): Promise<CypherQuery> {
  return must((await compiledPreset(options)).find((q) => String(q.functionId) === 'FF-DT03'), 'FF-DT03');
}

async function extract(options: Parameters<typeof extractAPG>[1]): Promise<APGResult> {
  const r = await extractAPG(FIXTURE, options);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Mirror of the member-fact template's WHERE and WITH (Cypher `=~` is a full match; the patterns are anchored). */
function mirror(q: CypherQuery, apg: APGResult): string[] {
  const patterns = strings((q.params as Record<string, unknown>).valueObjectPatterns).map((p) => new RegExp(p));
  return apg.nodes
    .filter((c) => c.type === 'Class' && patterns.some((p) => p.test(c.filePath)))
    .flatMap((c) => {
      const p = c.properties;
      const ro = strings(p.readonlyFields);
      const st = strings(p.staticFields);
      const members = [
        ...strings(p.publicFields).filter((f) => !ro.includes(f) && !st.includes(f)).map((f) => `${c.name}.${f} (public mutable field)`),
        ...strings(p.setAccessors).map((s) => `${c.name}.${s} (set accessor)`),
        ...strings(p.mutatorMethods).map((m) => `${c.name}.${m} (mutator method)`),
      ];
      return members.length > 0 ? [`${c.filePath}: ${members.join(', ')}`] : [];
    })
    .sort();
}

describe('compile', () => {
  it('the v1.3 compile selects the member-fact text for FF-DT03; the frozen compile keeps the proxy text', async () => {
    const v13 = await dt03(V13_COMPILE_OPTIONS);
    const frozen = await dt03({});
    const v13NoFacts = await dt03({ ...V13_COMPILE_OPTIONS, memberFacts: false });
    expect(V13_COMPILE_OPTIONS.memberFacts).toBe(true);
    expect(v13.cypher).toBe(must(DDD_MEMBER_FACT_TEMPLATES.get('value-object-immutability'), 'template').template.replace('/*EXCLUDE:c*/', ''));
    expect(frozen.cypher).toBe(must(DDD_TEMPLATES.get('value-object-immutability'), 'template').template.replace('/*EXCLUDE:c*/', ''));
    expect(v13NoFacts.cypher).toBe(frozen.cypher);
  });

  it('binds the value-object globs only (no setter-name pattern)', async () => {
    const q = await dt03(V13_COMPILE_OPTIONS);
    expect(Object.keys(q.params)).toEqual(['valueObjectPatterns']);
    expect(strings((q.params as Record<string, unknown>).valueObjectPatterns).length).toBeGreaterThan(0);
    expect(q.severity).toBe('critical');
  });

  it('the Cypher reads the three clauses of the definition and no edge', async () => {
    const { cypher } = await dt03(V13_COMPILE_OPTIONS);
    expect(cypher).toContain('MATCH (c:Class)');
    expect(cypher).not.toMatch(/-\[/);
    expect(cypher).toContain('NOT f IN coalesce(c.readonlyFields, []) AND NOT f IN coalesce(c.staticFields, [])');
    expect(cypher).toContain("[s IN coalesce(c.setAccessors, []) | c.name + '.' + s + ' (set accessor)']");
    expect(cypher).toContain("[m IN coalesce(c.mutatorMethods, []) | c.name + '.' + m + ' (mutator method)']");
    // One row per value object: the reference runner matches findings one-to-one by rule and file.
    expect(cypher).toContain('WHERE size(members) > 0');
    expect(cypher).not.toContain('setterPattern');
  });

  it('exclude_paths are injected into the member-fact text', async () => {
    const input = compilerInputFromSpec(await parsedPreset());
    const withExclude = { ...input, fitnessFunctions: input.fitnessFunctions.map((f) => (String(f.id) === 'FF-DT03' ? { ...f, excludePaths: ['src/legacy/**'] } : f)) };
    const r = compileFunctions(withExclude, V13_COMPILE_OPTIONS);
    if (!r.success) throw new Error('compile failed');
    const q = must(r.data.symbolicQueries.find((x) => String(x.functionId) === 'FF-DT03'), 'FF-DT03');
    expect(q.cypher).toContain('AND NONE(ep IN $excludePatterns WHERE c.filePath =~ ep)');
  });

  it('both texts share one result mapping, whose message fits a field, an accessor and a method', () => {
    const frozen = must(DDD_TEMPLATES.get('value-object-immutability'), 'frozen').resultMapping;
    const facts = must(DDD_MEMBER_FACT_TEMPLATES.get('value-object-immutability'), 'facts').resultMapping;
    expect(facts).toBe(frozen);
    expect(frozen.discriminatorColumns).toEqual(['class', 'method']);
    expect(frozen.messageTemplate).toBe('Value object {class} in {filePath} is mutable through {method}');
  });
});

describe('the compiled query over the fixture (TypeScript mirror)', () => {
  it('reports exactly the mutable members of value objects (v1.3 extraction)', async () => {
    expect(mirror(await dt03(V13_COMPILE_OPTIONS), await extract(V13_DEFAULT_OPTIONS))).toEqual(EXPECTED);
  });

  it('immutable value objects (readonly fields; private fields behind getters) and the entity give no row', async () => {
    const rows = mirror(await dt03(V13_COMPILE_OPTIONS), await extract(V13_DEFAULT_OPTIONS));
    expect(rows.filter((r) => /Money|Email|Order/.test(r))).toEqual([]);
  });

  it('on a graph without member facts (v1.2E extraction) the query returns no row', async () => {
    expect(mirror(await dt03(V13_COMPILE_OPTIONS), await extract(V12E_DEFAULT_OPTIONS))).toEqual([]);
  });

  it('the frozen proxy finds none of these members (no fixture method is named set + capital)', async () => {
    const q = await dt03({});
    const setter = new RegExp(`^(?:${String((q.params as Record<string, unknown>).setterPattern)})$`);
    const apg = await extract(V13_DEFAULT_OPTIONS);
    const named = apg.nodes.filter((n) => n.type === 'Method' && n.filePath.includes('/value-objects/') && setter.test(n.name.split('.').pop() ?? ''));
    expect(named).toEqual([]);
  });
});

const env = resolveGoldenEnv();
const describeNeo4j = env.enabled ? describe : describe.skip;
if (!env.enabled) {
  console.info(`ddd-member-facts (Neo4j block): skipped (${env.reason})`);
}

describeNeo4j('the compiled Cypher on Neo4j', () => {
  let repo: Neo4jRepository | undefined;
  beforeAll(() => {
    if (!env.enabled) return;
    repo = new Neo4jRepository({ neo4jUri: env.neo4j.uri, neo4jUser: env.neo4j.user, neo4jPassword: env.neo4j.password });
  });
  afterAll(async () => { await repo?.close(); });

  async function run(q: CypherQuery, apg: APGResult): Promise<string[]> {
    const spec = await parsedPreset();
    const { annotations } = annotateNodes(apg.nodes, spec.layerModel);
    const db = must(repo, 'Neo4j repository');
    expect((await db.clearGraph()).success).toBe(true);
    expect((await ensureIndexes(db)).success).toBe(true);
    expect((await ingestNodes(apg.nodes, annotations, db)).success).toBe(true);
    expect((await ingestEdges(apg.edges, db)).success).toBe(true);
    const r = await db.executeQuery(q.cypher, { ...q.params });
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    return r.data.records.map((row) => `${String(row.filePath)}: ${String(row.method)}`).sort();
  }

  it('equals the mirror on the v1.3 extraction', async () => {
    expect(await run(await dt03(V13_COMPILE_OPTIONS), await extract(V13_DEFAULT_OPTIONS))).toEqual(EXPECTED);
  });

  it('returns no row on the v1.2E extraction', async () => {
    expect(await run(await dt03(V13_COMPILE_OPTIONS), await extract(V12E_DEFAULT_OPTIONS))).toEqual([]);
  });
});
