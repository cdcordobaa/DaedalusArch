/**
 * v1.4 U3 D2: A1 + A2 into the in-process graph (`MemoryGraphRepository`; Neo4j is never touched). The APG edge names
 * the Sem rules rely on (`DECLARES`, `CONTAINS`) are confirmed on an ingested fixture.
 */
import { buildFacts, loadFacts } from '../../../../src/apg-enrich/ontology/index.js';
import type { FactsFile, OntologyInput } from '../../../../src/apg-enrich/ontology/index.js';
import { MemoryGraphRepository } from '../../../../src/cypher-interp/index.js';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';
import { LAYERS, fixtureInput, replayDetail } from './helpers.js';

async function rows(repo: MemoryGraphRepository, q: string): Promise<Record<string, unknown>[]> {
  const r = await repo.executeQuery(q);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return [...r.data.records];
}

describe('loadFacts (A1 + A2 into the in-process graph)', () => {
  const c = 'case-01-rule-dup-shapes';
  let input: OntologyInput;
  let a2: FactsFile;
  let repo: MemoryGraphRepository;
  let apgBefore: string;

  beforeAll(async () => {
    input = await fixtureInput(c);
    a2 = buildFacts(await replayDetail(input, c), input, { projectId: c, layerModelPath: null });
    apgBefore = canonicalJSON(input.apg);
    repo = new MemoryGraphRepository();
    const r = await loadFacts(input.apg, LAYERS, a2, repo);
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  }, 120_000);

  it('confirms the APG edge names: File-[:DECLARES]->Class-[:CONTAINS]->Method', async () => {
    expect((await rows(repo, 'MATCH (c:Class)-[r]->(m:Method) RETURN DISTINCT type(r) AS t')).map((x) => x.t)).toEqual(['CONTAINS']);
    expect((await rows(repo, 'MATCH (f:File)-[r]->(c:Class) RETURN DISTINCT type(r) AS t')).map((x) => x.t)).toContain('DECLARES');
  });

  it('puts the parser facts on the Class nodes and leaves the APG object unchanged', async () => {
    const cls = await rows(repo, 'MATCH (c:Class) RETURN c.name AS name, c.layerKind AS layerKind, c.context AS context, c.contextDeclared AS declared ORDER BY name');
    expect(cls.length).toBeGreaterThan(0);
    expect(cls.every((x) => typeof x.layerKind === 'string' && typeof x.context === 'string' && x.declared === false)).toBe(true);
    expect(cls.find((x) => x.name === 'ShippingPolicy')).toMatchObject({ layerKind: 'domain', context: 'checkout' });
    expect(canonicalJSON(input.apg)).toBe(apgBefore);
  });

  it('writes the Sem nodes and edges with scalar fact properties, SemRULE_VERIFIED once per pair', async () => {
    const enforces = await rows(repo, 'MATCH (m:Method)-[e:SemENFORCES]->(r:SemBusinessRule) RETURN e.factId AS f, e.agreement AS a, e.source AS s');
    expect(enforces.length).toBe(a2.facts.filter((f) => f.predicate === 'enforcesRule').length);
    expect(enforces.every((x) => typeof x.f === 'string' && x.s === 'model' && x.a === 'agreed')).toBe(true);
    const verified = await rows(repo, 'MATCH (a:Method)-[v:SemRULE_VERIFIED]->(b:Method) RETURN a.id AS a, b.id AS b, v.verified AS verified, v.method AS method');
    expect(verified).toHaveLength(a2.facts.filter((f) => f.predicate === 'ruleEquivalenceVerified').length);
    expect(verified.every((x) => String(x.a) < String(x.b))).toBe(true);
    expect(verified[0]).toMatchObject({ verified: true, method: 'comparison-pattern' });
    expect(Number((await rows(repo, 'MATCH (c:Class)-[:SemRESPONSIBLE_FOR]->(r:SemResponsibility) RETURN count(r) AS n'))[0]?.n)).toBe(a2.facts.filter((f) => f.predicate === 'hasResponsibility').length);
  });

  it('writes no SemBusinessRule for an input-validation rule (BR-U3-18)', async () => {
    const asInput: FactsFile = { ...a2, facts: a2.facts.map((f) => f.predicate !== 'enforcesRule' ? f : { ...f, value: { ...(f.value as object), kind: 'input-validation', ruleId: null } as typeof f.value }) };
    const r2 = new MemoryGraphRepository();
    const r = await loadFacts(input.apg, LAYERS, asInput, r2);
    expect(r.success).toBe(true);
    expect(await rows(r2, 'MATCH (r:SemBusinessRule) RETURN r.id AS id')).toEqual([]);
    expect(await rows(r2, 'MATCH ()-[e:SemENFORCES]->() RETURN e.factId AS f')).toEqual([]);
  });
});
