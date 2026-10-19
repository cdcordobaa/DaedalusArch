/**
 * Ontology v0 pipeline on the planted ground-truth cases, replayed from the recorded-fixture cassettes
 * (`tests/fixtures/v1.3-ontology/cassettes-mock`, recorded from the scripted mock answers): no provider is called.
 * The scripted answers are not model output; these tests check the pipeline, the validator, the cache and the scorer.
 */
import { MockFailure, MockOntologyProvider, NoCallProvider, aggregate, createScriptedResponder, diskReader, estimateOntology, runOntology, scoreCase } from '../../../../src/apg-enrich/ontology/index.js';
import type { CaseScore, OntologyInput, OntologyResult } from '../../../../src/apg-enrich/ontology/index.js';
import { prepareOntologyInput } from '../../../../src/apg-enrich/ontology/index.js';
import { buildContext } from '../../../../src/apg-enrich/cheap/context.js';
import { DEFAULT_CHEAP_OPTIONS } from '../../../../src/apg-enrich/cheap/types.js';
import { PROMPT_VERSION, buildUnits } from '../../../../src/apg-enrich/ontology/index.js';
import { rulePrompt } from '../../../../src/apg-enrich/ontology/prompts.js';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';
import { CASES, FIXTURES, LAYERS, fixtureInput, manifest, mockAnswers, tempDir } from './helpers.js';

const MOCK = { provider: 'mock', model: 'mock-ontology', temperature: null } as const;

async function replay(input: OntologyInput, caseId: string): Promise<OntologyResult> {
  return (await runOntology(input, { provider: new NoCallProvider(MOCK), cacheMode: 'replay', cacheDir: `${FIXTURES}/cassettes-mock/${caseId}` })).result;
}

describe('ontology pipeline on the planted cases (cassette replay)', () => {
  const inputs = new Map<string, OntologyInput>();
  const results = new Map<string, OntologyResult>();
  const scores: CaseScore[] = [];

  beforeAll(async () => {
    for (const c of CASES) {
      const input = await fixtureInput(c);
      inputs.set(c, input);
      const before = canonicalJSON(input.apg);
      const r = await replay(input, c);
      expect(canonicalJSON(input.apg)).toBe(before); // symbolic facts are never modified
      results.set(c, r);
      scores.push(scoreCase(manifest(c), r, { cheap: input.cheap, apg: input.apg }));
    }
  }, 180_000);

  it('answers every call from the cassettes', () => {
    for (const r of results.values()) {
      expect(r.calls).toMatchObject({ providerCalls: 0, cassetteMisses: 0, invalid: 0 });
      expect(r.calls.cacheHits).toBeGreaterThan(0);
      expect(r.stopped).toBeNull();
    }
  });

  it('keeps every Sem label and edge type in the Sem namespace, with provenance and grounded evidence', () => {
    for (const r of results.values()) {
      for (const n of r.nodes) {
        expect(n.label).toMatch(/^Sem/);
        expect(n.id).toMatch(/^sem:Sem/);
        expect(n.provenance).toMatchObject({ model: 'mock-ontology', runId: r.runId, temperature: null });
        expect(n.evidence.length).toBeGreaterThan(0);
        expect(n.evidence.every((e) => e.grounded === true as boolean)).toBe(true);
      }
      for (const e of r.edges) expect(e.type).toMatch(/^Sem[A-Z_]+$/);
    }
  });

  it('finds two of the three planted defects; case-03 is out of N4 scope (no declared context), and no forbidden one', () => {
    const agg = aggregate(scores);
    expect(agg).toMatchObject({ expected: 3, found: 2, forbiddenHits: 0, unexpected: 0, cheapCaughtExpected: 0, cheapFlaggedForbidden: 1 });
    const dup = results.get('case-01-rule-dup-shapes')?.findings[0];
    expect(dup).toMatchObject({ kind: 'semantic-rule-duplication', components: ['checkout', 'invoicing'], verification: { verified: true, method: 'comparison-pattern' } });
    expect(results.get('case-02-misplaced-pricing')?.findings).toEqual([expect.objectContaining({ kind: 'misplaced-responsibility', naturalLayer: 'domain', classLayer: 'application' })]);
    // N4 (BR-U3-09): the cross-context Customer identity is kept as a concept cluster, but it is no finding.
    const r03 = results.get('case-03-concept-fragmentation');
    expect(r03?.findings.filter((f) => f.kind === 'concept-fragmentation')).toEqual([]);
    const customer = r03?.nodes.find((n) => n.label === 'SemBusinessConcept' && n.name === 'Customer');
    expect(customer).toBeDefined();
    const definers = r03?.edges.filter((e) => e.type === 'SemEMBODIES' && e.targetId === customer?.id && e.properties.relation === 'defines') ?? [];
    expect(definers.length).toBeGreaterThanOrEqual(3);
  });

  it('BR-U3-18: an input-validation rule is a rule site but enters no rule cluster and no duplication finding', async () => {
    const c = 'case-01-rule-dup-shapes';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    const script = mockAnswers(c);
    const asInput = { ...script, responses: script.responses.map((e) => e.pass !== 'rules' ? e : { ...e, answer: { rules: ((e.answer as { rules: Record<string, unknown>[] }).rules).map((r) => ({ ...r, kind: 'input-validation' })) } }) };
    const mock = new MockOntologyProvider(createScriptedResponder(asInput, input.apg, diskReader(input.projectRoot)));
    const detail = await runOntology(input, { provider: mock });
    expect(detail.ruleSites.length).toBeGreaterThan(0);
    expect(detail.ruleSites.every((r) => r.rule.out.kind === 'input-validation')).toBe(true);
    expect(detail.clusters.rules.clusters).toEqual([]);
    expect(detail.clusters.rules.adjudications).toEqual([]);
    expect(detail.result.findings.filter((f) => f.kind === 'semantic-rule-duplication')).toEqual([]);
    expect(detail.result.nodes.filter((n) => n.label === 'SemBusinessRule')).toEqual([]);
  }, 60_000);

  it('BR-U3-07/09 positive: case-03 with one declared context around all three definers gives one in-context fragmentation finding; split into one context per component it gives none', async () => {
    const c = 'case-03-concept-fragmentation';
    const ctx = (name: string, root: string) => ({ name, root, publicApi: [], acl: [] });
    const ddd = (contexts: ReturnType<typeof ctx>[]) => ({ sourceRoot: 'src/', contexts, outsideContexts: [], aggregates: [], valueObjects: [], repositories: [], domainEventTypes: [], applicationServices: [] });
    const run = async (contexts: ReturnType<typeof ctx>[]) => {
      const input = await prepareOntologyInput(`${FIXTURES}/${c}`, { layerModel: { ...LAYERS, ddd: ddd(contexts) } });
      const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot)));
      return (await runOntology(input, { provider: mock })).result.findings.filter((f) => f.kind === 'concept-fragmentation');
    };
    const one = await run([ctx('customers', 'src')]);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ components: ['customers'] });
    expect((one[0] as { classes: unknown[] }).classes.length).toBeGreaterThanOrEqual(2);
    expect(await run([ctx('sales', 'src/sales'), ctx('billing', 'src/billing'), ctx('accounts', 'src/accounts')])).toEqual([]);
  }, 60_000);

  it('BR-U3-11: the rule prompt asks for business rules and input checks with their kind, and names no case', () => {
    const input = inputs.get('case-02-misplaced-pricing');
    if (input === undefined) throw new Error('no input');
    const ctx = buildContext({ apg: input.apg, project: input.project, projectRoot: input.projectRoot, layerModel: LAYERS }, DEFAULT_CHEAP_OPTIONS);
    const units = buildUnits(ctx, input.cheap, { ruleMinDensity: 1 });
    const cand = units.ruleCandidates[0];
    if (cand === undefined) throw new Error('no rule candidate');
    const task = rulePrompt(cand.cls, cand.methods).split('## Class')[0] ?? '';
    expect(PROMPT_VERSION).toBe('ontology-v0.3');
    expect(task).not.toMatch(/not a technical check/);
    expect(task).toContain('kind "business"');
    expect(task).toContain('kind "input-validation"');
    for (const word of ['Order', 'Controller', 'quantity', 'gift', 'Customer', 'Shipping', '20']) expect(task).not.toContain(word);
  });

  it('rejects the four planted hallucinations and reports run agreement', () => {
    const h = [...results.values()].flatMap((r) => r.hallucinations);
    expect(h).toHaveLength(4);
    expect(h.every((x) => x.runIndex === 1)).toBe(true);
    expect(new Set(h.flatMap((x) => x.reasons.map((r) => r.reason)))).toEqual(new Set(['quote-mismatch', 'span-out-of-range', 'unknown-node', 'node-outside-item']));
    const a02 = results.get('case-02-misplaced-pricing')?.agreement.responsibility;
    expect(a02?.meanJaccard).toBeLessThan(1); // the planted disagreement (PlaceOrderUseCase natural layer)
    expect(results.get('case-04a-control-near-miss-rules')?.agreement.adjudicate).toMatchObject({ items: 1, meanJaccard: 1 });
  });

  it('is deterministic: a second replay gives byte-identical results', async () => {
    const c = 'case-01-rule-dup-shapes';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    expect(canonicalJSON(await replay(input, c))).toBe(canonicalJSON(results.get(c)));
  }, 60_000);

  it('the recorded cassettes match a fresh record from the scripted answers (prompts have not drifted)', async () => {
    const c = 'case-04a-control-near-miss-rules';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    const tmp = tempDir('ontology-rec-');
    try {
      const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot)));
      const fresh = (await runOntology(input, { provider: mock, cacheMode: 'record', cacheDir: tmp.dir })).result;
      expect(canonicalJSON({ ...fresh, calls: null })).toBe(canonicalJSON({ ...results.get(c), calls: null }));
    } finally {
      tmp.cleanup();
    }
  }, 60_000);

  it('estimates the calls without calling, and the estimate bounds the real count', () => {
    for (const c of CASES) {
      const input = inputs.get(c);
      const r = results.get(c);
      if (input === undefined || r === undefined) throw new Error('no input');
      const e = estimateOntology(input, { provider: new NoCallProvider(MOCK), cacheMode: 'replay', cacheDir: `${FIXTURES}/cassettes-mock/${c}` });
      expect(e.calls.responsibility + e.calls.rules).toBeLessThanOrEqual(r.calls.cacheHits);
      expect(e.cachedKnown).toBe(e.calls.responsibility + e.calls.rules);
      expect(e.totalUpperBound).toBeGreaterThanOrEqual(r.calls.cacheHits);
    }
  });

  it('stops on a usage limit, keeps what was recorded, and resumes from the cache', async () => {
    const c = 'case-03-concept-fragmentation';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    const tmp = tempDir('ontology-stop-');
    try {
      const scripted = createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot));
      let n = 0;
      const limited = new MockOntologyProvider((req) => (++n > 5 ? new MockFailure('LLM_USAGE_LIMIT', "You've hit your limit") : scripted(req)));
      const first = (await runOntology(input, { provider: limited, cacheMode: 'record', cacheDir: tmp.dir })).result;
      expect(first.stopped).toMatchObject({ code: 'LLM_USAGE_LIMIT', pass: 'responsibility' });
      expect(first.calls.providerCalls).toBe(6);
      const resumed = new MockOntologyProvider(scripted);
      const second = (await runOntology(input, { provider: resumed, cacheMode: 'record', cacheDir: tmp.dir })).result;
      expect(second.stopped).toBeNull();
      expect(second.calls.cacheHits).toBe(5);
      expect(second.findings).toEqual(results.get(c)?.findings);
    } finally {
      tmp.cleanup();
    }
  }, 60_000);

  it('skips calls beyond the per-project budget', async () => {
    const c = 'case-03-concept-fragmentation';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot)));
    const r = (await runOntology(input, { provider: mock, budget: 4 })).result;
    expect(r.calls.providerCalls).toBe(4);
    expect(r.calls.skippedForBudget).toBeGreaterThan(0);
    expect(mock.received()).toHaveLength(4);
  }, 60_000);
});
