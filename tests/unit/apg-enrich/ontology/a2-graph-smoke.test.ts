/**
 * v1.4 U9 S4 (REV-05 §4 SO2: "build the loader, so 'in the graph' is literally true"). Mock mode, zero model calls,
 * no Neo4j: the model facts the runner writes to `facts.json` are read back from disk, loaded into the in-process graph
 * next to A1, and read by SEM-MISPLACED, SEM-DUP and SEM-FRAG through their Cypher text.
 *
 * - case-02 (SEM-MISPLACED) and case-01 (SEM-DUP): `scripts/v1.3/ontology-run.ts --fixtures --provider mock --replay`
 *   (the committed mock cassettes), so `facts.json` and `verdicts.json` are the runner's own files.
 * - NS-02 case-05 (SEM-FRAG, one declared context): a scripted mock record (cache off), its A2 written to a file.
 *
 * Each case proves the claim three ways: every model fact that maps to a Sem edge is an edge carrying its `factId`;
 * every verdict cites model facts of the file; and the verdict follows the fact values in the graph (remove the model
 * facts: no verdict; change the one value the rule compares: no verdict).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  LOADED_SEM_EDGES, MockOntologyProvider, SEM_RULES, buildFacts, createScriptedResponder, diskReader, loadFacts, prepareOntologyInput,
  runOntology, runSemRules,
} from '../../../../src/apg-enrich/ontology/index.js';
import type { Fact, FactsFile, ScriptedAnswers, SemVerdict } from '../../../../src/apg-enrich/ontology/index.js';
import { MemoryGraphRepository } from '../../../../src/cypher-interp/index.js';
import type { APGResult } from '../../../../src/shared/types/apg.js';
import type { LayerModel } from '../../../../src/shared/types/spec.js';
import { main } from '../../../../scripts/v1.3/ontology-run.js';
import { FIXTURES, LAYERS, tempDir } from './helpers.js';

const CASE05 = path.join(FIXTURES, 'ns02', 'case-05-fragmentation-in-context');
const EDGE_PREDICATES: ReadonlySet<string> = new Set(['hasResponsibility', 'embodiesConcept', 'realizesCapability', 'sameConceptAs', 'sameRuleAs']);

interface Loaded { readonly repo: MemoryGraphRepository; readonly verdicts: SemVerdict[] }

async function load(apg: APGResult, layers: LayerModel, a2: FactsFile): Promise<Loaded> {
  const repo = new MemoryGraphRepository();
  const l = await loadFacts(apg, layers, a2, repo);
  if (!l.success) throw new Error(l.errors.map((e) => e.message).join('; '));
  const v = await runSemRules(repo, a2, a2.producer.factPolicy);
  if (!v.success) throw new Error(v.errors.map((e) => e.message).join('; '));
  return { repo, verdicts: v.data };
}

/** Every `factId` on a model-sourced Sem edge, by edge type, through Cypher. */
async function modelEdgeFacts(repo: MemoryGraphRepository): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const t of LOADED_SEM_EDGES) {
    const r = await repo.executeQuery(`MATCH (a)-[e:${t}]->(b) WHERE e.source = 'model' RETURN e.factId AS f`);
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    for (const row of r.data.records) ids.add(String(row.f));
  }
  return ids;
}

/** The model facts the loader must turn into Sem edges (input-validation rules stay A2-only, BR-U3-18). */
function edgeFacts(a2: FactsFile): Set<string> {
  return new Set(a2.facts.filter((f) => f.source === 'model' && (EDGE_PREDICATES.has(f.predicate) || (f.predicate === 'enforcesRule' && (f.value as { kind?: string }).kind === 'business'))).map((f) => f.id));
}

function withFacts(a2: FactsFile, facts: readonly Fact[]): FactsFile {
  return { ...a2, facts };
}

function readA2(file: string): FactsFile {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as FactsFile;
}

function proveInGraph(a2: FactsFile, loaded: Loaded, edges: Set<string>, rule: SemVerdict['rule']): void {
  // 1. The model facts are in the graph, each as an edge that carries its fact id.
  expect(edges.size).toBeGreaterThan(0);
  expect([...edgeFacts(a2)].sort()).toEqual([...edges].sort());
  // 2. The rule's verdict cites model facts of facts.json.
  const model = new Map(a2.facts.filter((f) => f.source === 'model').map((f) => [f.id, f]));
  const v = loaded.verdicts.filter((x) => x.rule === rule);
  expect(v.length).toBeGreaterThan(0);
  for (const x of v) {
    expect(x.facts.length).toBeGreaterThan(0);
    for (const id of x.facts) expect(model.has(id)).toBe(true);
  }
}

describe('A2 loader smoke: facts.json -> graph -> Sem rules through Cypher (mock mode, zero calls)', () => {
  let dir: string;
  let cleanup: () => void;
  beforeAll(async () => {
    ({ dir, cleanup } = tempDir('a2-smoke-'));
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(await main(['--fixtures', '--provider', 'mock', '--replay', '--cassettes', path.join(FIXTURES, 'cassettes-mock'), '--out', dir])).toBe(0);
    } finally {
      spy.mockRestore();
    }
  }, 300_000);
  afterAll(() => cleanup());

  it('the Sem rule texts are Cypher and name the loaded Sem edges', () => {
    expect(SEM_RULES['SEM-MISPLACED']).toContain('SemRESPONSIBLE_FOR');
    expect(SEM_RULES['SEM-DUP']).toContain('SemENFORCES');
    expect(SEM_RULES['SEM-FRAG']).toContain('SemEMBODIES');
  });

  it('SEM-MISPLACED reads the naturalLayer of a model fact in the graph (case-02)', async () => {
    const c = 'case-02-misplaced-pricing';
    const a2 = readA2(path.join(dir, c, 'facts.json'));
    const input = await prepareOntologyInput(path.join(FIXTURES, c), { layerModel: LAYERS });
    const loaded = await load(input.apg, LAYERS, a2);
    proveInGraph(a2, loaded, await modelEdgeFacts(loaded.repo), 'SEM-MISPLACED');
    expect(JSON.parse(fs.readFileSync(path.join(dir, c, 'verdicts.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(loaded.verdicts)));
    const sem = await loaded.repo.executeQuery('MATCH (c:Class)-[e:SemRESPONSIBLE_FOR]->(r:SemResponsibility) WHERE r.naturalLayer <> c.layerKind RETURN c.name AS cls, r.naturalLayer AS natural, c.layerKind AS layer, e.factId AS fact');
    expect(sem.success && sem.data.records).toEqual([expect.objectContaining({ cls: 'OrderNotificationService', natural: 'domain', layer: 'application' })]);

    // Ablations: A1 alone gives no verdict; the same fact with the class's own layer gives none either.
    expect((await load(input.apg, LAYERS, withFacts(a2, a2.facts.filter((f) => f.source === 'parser')))).verdicts).toEqual([]);
    const cited = new Set(loaded.verdicts.flatMap((v) => v.facts));
    const moved = a2.facts.map((f) => (cited.has(f.id) ? { ...f, value: { ...(f.value as object), naturalLayer: 'application' } as Fact['value'] } : f));
    expect((await load(input.apg, LAYERS, withFacts(a2, moved))).verdicts.filter((v) => v.rule === 'SEM-MISPLACED')).toEqual([]);
  }, 120_000);

  it('SEM-DUP reads two SemENFORCES edges to one SemBusinessRule across contexts (case-01)', async () => {
    const c = 'case-01-rule-dup-shapes';
    const a2 = readA2(path.join(dir, c, 'facts.json'));
    const input = await prepareOntologyInput(path.join(FIXTURES, c), { layerModel: LAYERS });
    const loaded = await load(input.apg, LAYERS, a2);
    proveInGraph(a2, loaded, await modelEdgeFacts(loaded.repo), 'SEM-DUP');
    expect(JSON.parse(fs.readFileSync(path.join(dir, c, 'verdicts.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(loaded.verdicts)));
    // Drop one side's enforcesRule fact: one enforcer is left, so no duplication.
    const dup = loaded.verdicts.find((v) => v.rule === 'SEM-DUP');
    const oneSide = a2.facts.find((f) => f.predicate === 'enforcesRule' && dup?.facts.includes(f.id));
    expect(oneSide).toBeDefined();
    expect((await load(input.apg, LAYERS, withFacts(a2, a2.facts.filter((f) => f.id !== oneSide?.id)))).verdicts.filter((v) => v.rule === 'SEM-DUP')).toEqual([]);
  }, 120_000);

  it('SEM-FRAG reads two SemEMBODIES {defines} edges to one concept inside one declared context (NS-02 case-05)', async () => {
    const layers = JSON.parse(fs.readFileSync(path.join(CASE05, 'layers.json'), 'utf8')) as LayerModel;
    const input = await prepareOntologyInput(CASE05, { layerModel: layers });
    // Scripted mock answers (NOT model output): Customer and Client both define the customer concept.
    const concept = (cls: string): ScriptedAnswers['responses'][number] => ({ pass: 'responsibility', item: cls, answer: { responsibilities: [], concepts: [{ name: 'Customer', relation: 'defines', confidence: 0.9, evidence: [{ node: cls, quote: `export class ${cls}` }] }] } });
    const script: ScriptedAnswers = { case: 'case-05-fragmentation-in-context', responses: [concept('Customer'), concept('Client')] };
    const detail = await runOntology(input, { provider: new MockOntologyProvider(createScriptedResponder(script, input.apg, diskReader(input.projectRoot))), runs: 2, cacheMode: 'off', cacheDir: null, now: () => '2026-10-19T00:00:00.000Z' });
    expect(detail.result.calls.providerCalls).toBeGreaterThan(0); // mock calls, no model
    const file = path.join(dir, 'case-05', 'facts.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(buildFacts(detail, input, { projectId: 'case-05-fragmentation-in-context', layerModelPath: null }), null, 2)}\n`);
    const a2 = readA2(file);
    const loaded = await load(input.apg, layers, a2);
    proveInGraph(a2, loaded, await modelEdgeFacts(loaded.repo), 'SEM-FRAG');
    expect(loaded.verdicts.find((v) => v.rule === 'SEM-FRAG')).toMatchObject({ context: 'sales', sites: expect.arrayContaining([expect.any(String), expect.any(String)]) as unknown });
    const decl = await loaded.repo.executeQuery("MATCH (c:Class) WHERE c.contextDeclared = true AND c.context = 'sales' RETURN c.name AS n ORDER BY n");
    expect(decl.success && decl.data.records.map((r) => r.n)).toEqual(expect.arrayContaining(['Client', 'Customer']));
    // One class "uses" the concept instead of defining it: no fragmentation.
    const uses = a2.facts.map((f, i) => (f.predicate === 'embodiesConcept' && i === a2.facts.findIndex((g) => g.predicate === 'embodiesConcept') ? { ...f, value: { ...(f.value as object), relation: 'uses' } as Fact['value'] } : f));
    expect((await load(input.apg, layers, withFacts(a2, uses))).verdicts.filter((v) => v.rule === 'SEM-FRAG')).toEqual([]);
  }, 120_000);
});
