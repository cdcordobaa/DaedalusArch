/**
 * v1.4 U3 D1: the A2 facts file (invariants I1 to I5, stable ids, byte-identical rebuilds, the vocabulary guard, no
 * verdicts in A2, the case-02 golden fact). Mock cassettes and scripted answers only; no provider is called.
 */
import { A2InvariantError, FACT_PREDICATES, MockOntologyProvider, NoCallProvider, VERDICT_SHAPED, buildFacts, createScriptedResponder, diskReader, factId, runOntology, validateFacts } from '../../../../src/apg-enrich/ontology/index.js';
import type { Fact, FactsFile, OntologyInput, ScriptedAnswers } from '../../../../src/apg-enrich/ontology/index.js';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';
import { MOCK_DESCRIPTION, fixtureInput, mockAnswers, nodeId, projectInput, replayDetail, tempDir } from './helpers.js';

const LAYERS_PATH = 'tests/fixtures/v1.3-ontology/layers.json';
const NOW = (): string => '2026-10-15T00:00:00.000Z';

function rehash(f: Omit<Fact, 'id'> & { id?: string }): Fact {
  const { id: _drop, ...rest } = f;
  return { id: factId(rest), ...rest };
}

function violations(file: FactsFile, input: OntologyInput): string[] {
  try {
    validateFacts(file, input.apg);
    return [];
  } catch (e) {
    if (e instanceof A2InvariantError) return [...e.violations];
    throw e;
  }
}

describe('A2 facts file', () => {
  let input02: OntologyInput;
  let a2: FactsFile;

  beforeAll(async () => {
    input02 = await fixtureInput('case-02-misplaced-pricing');
    a2 = buildFacts(await replayDetail(input02, 'case-02-misplaced-pricing'), input02, { projectId: 'case-02-misplaced-pricing', layerModelPath: LAYERS_PATH });
  }, 120_000);

  it('has the NS-02 envelope with the run-level fact policy', () => {
    expect(a2).toMatchObject({
      schemaVersion: 1, artifact: 'A2', project: { id: 'case-02-misplaced-pricing', commit: null },
      inputs: { layerModel: { path: LAYERS_PATH } },
      producer: { part: 'C1d', pipeline: 'ontology-v0', promptVersion: 'ontology-v0.3', provider: 'mock', model: 'mock-ontology', runs: 2, factPolicy: 'agreed-only' },
    });
    expect(a2.inputs.a1.apgHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a2.project.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a2.facts.length).toBeGreaterThan(0);
    expect(violations(a2, input02)).toEqual([]);
  });

  it('holds the case-02 golden fact: OrderNotificationService has a domain responsibility, agreed, grounded at line 9', () => {
    const cls = nodeId(input02, 'Class', 'OrderNotificationService');
    const f = a2.facts.find((x) => x.subject === cls && x.predicate === 'hasResponsibility' && (x.value as { naturalLayer: string }).naturalLayer === 'domain');
    expect(f).toMatchObject({ source: 'model', basis: null, modelId: 'mock-ontology', agreement: 'agreed', runIndex: null, date: '2026-10-15T00:00:00.000Z' });
    expect(f?.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(f?.evidence.some((e) => e.startLine === 9 && e.file === 'src/notifications/application/order-notification.service.ts')).toBe(true);
    expect(a2.facts.find((x) => x.subject === cls && x.predicate === 'inLayer')).toMatchObject({ value: 'application', source: 'parser', basis: 'apg', evidence: [] });
    expect(a2.facts.find((x) => x.subject === cls && x.predicate === 'inContext')).toMatchObject({ value: { context: 'notifications', declared: false }, basis: 'apg' });
  });

  it('never carries findings: no verdict field and no verdict-shaped predicate (N1, I4)', () => {
    const text = JSON.stringify(a2);
    for (const k of ['findings', 'misplaced-responsibility', 'semantic-rule-duplication', 'concept-fragmentation']) expect(text).not.toContain(k);
    for (const p of FACT_PREDICATES) for (const bad of VERDICT_SHAPED) expect(p.toLowerCase()).not.toContain(bad.toLowerCase());
  });

  describe('invariants (each broken alone)', () => {
    const first = (pred: string, source: string): Fact => {
      const f = a2.facts.find((x) => x.predicate === pred && x.source === source);
      if (f === undefined) throw new Error(`no ${pred}`);
      return f;
    };
    const withFact = (bad: Fact): FactsFile => ({ ...a2, facts: [...a2.facts.filter((x) => x.id !== bad.id), bad].sort((a, b) => (a.predicate < b.predicate ? -1 : a.predicate > b.predicate ? 1 : a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : a.id < b.id ? -1 : 1)) });

    it('I1: a subject outside A1 is rejected', () => {
      const v = violations(withFact(rehash({ ...first('inLayer', 'parser'), subject: 'no-such-node' })), input02);
      expect(v.some((x) => x.startsWith('I1'))).toBe(true);
    });
    it('I1: a value.other outside A1 is rejected', () => {
      const v = violations(withFact(rehash({ ...first('sameConceptAs', 'parser'), value: { other: 'no-such-node', same: true } })), input02);
      expect(v.some((x) => x.startsWith('I1'))).toBe(true);
    });
    it('I2: a model fact without grounded evidence is rejected', () => {
      const v = violations(withFact(rehash({ ...first('hasResponsibility', 'model'), evidence: [] })), input02);
      expect(v.some((x) => x.startsWith('I2'))).toBe(true);
    });
    it('I2: a model fact without a model id is rejected', () => {
      const v = violations(withFact(rehash({ ...first('hasResponsibility', 'model'), modelId: null })), input02);
      expect(v.some((x) => x.startsWith('I2'))).toBe(true);
    });
    it('I3: a parser fact with model provenance is rejected', () => {
      const v = violations(withFact(rehash({ ...first('inLayer', 'parser'), confidence: 0.9 })), input02);
      expect(v.some((x) => x.startsWith('I3'))).toBe(true);
    });
    it('I4: a predicate outside the vocabulary is rejected', () => {
      const v = violations(withFact(rehash({ ...first('inLayer', 'parser'), predicate: 'violates' as Fact['predicate'] })), input02);
      expect(v.some((x) => x.startsWith('I4'))).toBe(true);
    });
    it('I5: a duplicate id, a wrong id and an unsorted file are rejected', () => {
      const f = first('inLayer', 'parser');
      expect(violations({ ...a2, facts: [f, ...a2.facts] }, input02).some((x) => x.includes('duplicate'))).toBe(true);
      expect(violations(withFact({ ...f, id: 'fact:0000000000000000' }), input02).some((x) => x.includes('content hash'))).toBe(true);
      expect(violations({ ...a2, facts: [...a2.facts].reverse() }, input02).some((x) => x.includes('not sorted'))).toBe(true);
    });
  });

  it('fact ids leave out the cluster ids, so a re-clustering keeps them', () => {
    const f = a2.facts.find((x) => x.predicate === 'embodiesConcept');
    if (f === undefined) throw new Error('no concept fact');
    expect(factId({ ...f, value: { ...(f.value as object), conceptId: 'sem:SemBusinessConcept:other' } as Fact['value'] })).toBe(f.id);
    expect(factId({ ...f, value: { ...(f.value as object), concept: 'Something else' } as Fact['value'] })).not.toBe(f.id);
  });

  it('is byte-identical on a rebuild and between a record and its replay (dates come from the cassettes)', async () => {
    const c = 'case-04a-control-near-miss-rules';
    const input = await fixtureInput(c);
    const tmp = tempDir('ontology-a2-');
    try {
      const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot)));
      const rec = await runOntology(input, { provider: mock, cacheMode: 'record', cacheDir: tmp.dir, now: NOW });
      const rep = await runOntology(input, { provider: new NoCallProvider(MOCK_DESCRIPTION), cacheMode: 'replay', cacheDir: tmp.dir });
      expect(rep.result.calls.providerCalls).toBe(0);
      const opts = { projectId: c, layerModelPath: LAYERS_PATH };
      const a = canonicalJSON(buildFacts(rec, input, opts));
      expect(canonicalJSON(buildFacts(rec, input, opts))).toBe(a);
      expect(canonicalJSON(buildFacts(rep, input, opts))).toBe(a);
    } finally {
      tmp.cleanup();
    }
  }, 120_000);

  it('verifies every cross-context pair of a business-rule cluster, also a transitive pair with no sameRuleAs fact', async () => {
    const method = (cls: string, op: string, n: number): string => `export class ${cls} {\n  check(total: number): number {\n    if (total ${op} ${String(n)}) return 0;\n    return 1;\n  }\n}\n`;
    const { input, cleanup } = await projectInput({
      'src/alpha/domain/a.ts': method('A', '>=', 50),
      'src/beta/domain/b.ts': method('B', '>=', 5000),
      'src/gamma/domain/c.ts': method('C', '>=', 500000),
    });
    try {
      const rule = (cls: string, n: number, subject: string): ScriptedAnswers['responses'][number] => ({
        pass: 'rules', item: cls,
        answer: { rules: [{ statement: `${cls} limit`, kind: 'business', subject, operator: '>=', threshold: n, unit: null, enforcedBy: `${cls}.check`, confidence: 0.9, evidence: [{ node: `${cls}.check`, quote: `total >= ${String(n)}` }] }] },
      });
      const script: ScriptedAnswers = { case: 'transitive', responses: [rule('A', 50, 'order total'), rule('B', 5000, 'order total'), rule('C', 500000, 'parcel weight'), { pass: 'adjudicate', contains: [], answer: { same: true, confidence: 0.8, rationale: 'same' } }] };
      const mock = new MockOntologyProvider(createScriptedResponder(script, input.apg, diskReader(input.projectRoot)));
      const detail = await runOntology(input, { provider: mock, now: NOW });
      expect(detail.clusters.rules.clusters).toHaveLength(1);
      const file = buildFacts(detail, input, { projectId: 'transitive', layerModelPath: null });
      const [a, c] = [nodeId(input, 'Method', 'A.check'), nodeId(input, 'Method', 'C.check')];
      const pair = (f: Fact): string[] => [f.subject, (f.value as { other: string }).other].sort();
      const same = file.facts.filter((f) => f.predicate === 'sameRuleAs').map(pair);
      const verified = file.facts.filter((f) => f.predicate === 'ruleEquivalenceVerified');
      expect(verified).toHaveLength(3);
      expect(same.some((p) => p.includes(a) && p.includes(c))).toBe(false);
      expect(verified.some((f) => pair(f).includes(a) && pair(f).includes(c))).toBe(true);
      expect(verified.every((f) => f.source === 'parser' && f.basis === 'verifier' && f.subject < (f.value as { other: string }).other)).toBe(true);
      expect(file.facts.filter((f) => f.predicate === 'enforcesRule').every((f) => (f.value as { ruleId: string | null }).ruleId !== null)).toBe(true);
    } finally {
      cleanup();
    }
  }, 120_000);

  it('an input-validation rule is an enforcesRule fact with no rule id (BR-U3-18)', async () => {
    const c = 'case-02-misplaced-pricing';
    const script = mockAnswers(c);
    const asInput: ScriptedAnswers = { ...script, responses: script.responses.map((e) => e.pass !== 'rules' ? e : { ...e, answer: { rules: (e.answer as { rules: Record<string, unknown>[] }).rules.map((r) => ({ ...r, kind: 'input-validation' })) } }) };
    const detail = await runOntology(input02, { provider: new MockOntologyProvider(createScriptedResponder(asInput, input02.apg, diskReader(input02.projectRoot))), now: NOW });
    const file = buildFacts(detail, input02, { projectId: c, layerModelPath: LAYERS_PATH });
    const rules = file.facts.filter((f) => f.predicate === 'enforcesRule');
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((f) => (f.value as { kind: string; ruleId: unknown }).kind === 'input-validation' && (f.value as { ruleId: unknown }).ruleId === null)).toBe(true);
  }, 120_000);
});
